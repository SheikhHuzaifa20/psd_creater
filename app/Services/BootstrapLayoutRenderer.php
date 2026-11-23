<?php

namespace App\Services;

/** Converts PSD geometry to Bootstrap sections with CSS Grid inside each row. */
class BootstrapLayoutRenderer
{
    private function escape(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function leaves(array $layers): array
    {
        $result = [];
        foreach ($layers as $layer) {
            if (! empty($layer['hidden'])) {
                continue;
            }
            if (($layer['type'] ?? '') === 'group') {
                $texts = array_values(array_filter($layer['children'] ?? [], fn ($child) => isset($child['text']) && trim($child['text']) !== ''));
                $questions = array_values(array_filter($texts, fn ($child) => preg_match('/\?\s*$/u', $child['text'])));
                if (count($texts) === 2 && count($questions) === 1) {
                    $question = $questions[0];
                    $answer = $texts[0] === $question ? $texts[1] : $texts[0];
                    $result[] = array_replace($question, [
                        'faqAnswer' => $answer['text'], 'faqQuestion' => $question['text'],
                        'text' => $question['text']."\n".$answer['text'],
                        'left' => $layer['left'] ?? $question['left'], 'top' => $layer['top'] ?? $question['top'],
                        'width' => $layer['width'] ?? $question['width'], 'height' => $layer['height'] ?? 140,
                        'right' => $layer['right'] ?? (($question['left'] ?? 0) + ($question['width'] ?? 300)),
                        'bottom' => $layer['bottom'] ?? (($question['top'] ?? 0) + 140),
                    ]);

                    continue;
                }
                array_push($result, ...$this->leaves($layer['children'] ?? []));
            } elseif (isset($layer['text']) || ! empty($layer['imagePath']) || ! empty($layer['shapeStyle'])) {
                $layer['left'] = (float) ($layer['left'] ?? 0);
                $layer['top'] = (float) ($layer['top'] ?? 0);
                $layer['width'] = max(1, (float) ($layer['width'] ?? (($layer['right'] ?? 300) - $layer['left'])));
                $layer['height'] = max(1, (float) ($layer['height'] ?? (($layer['bottom'] ?? 40) - $layer['top'])));
                $layer['right'] = $layer['left'] + $layer['width'];
                $layer['bottom'] = $layer['top'] + $layer['height'];
                $layer['order'] = count($result);
                $result[] = $layer;
            }
        }

        return $result;
    }

    private function color(?array $color): ?string
    {
        if (! $color || ! isset($color['r'], $color['g'], $color['b'])) {
            return null;
        }

        return 'rgb('.implode(',', array_map(fn ($channel) => max(0, min(255, (int) round($color[$channel]))), ['r', 'g', 'b'])).')';
    }

    private function textStyle(array $style): string
    {
        $size = max(1, min(400, (float) ($style['fontSize'] ?? 16)));
        $fontName = $style['font']['name'] ?? $style['fontName'] ?? 'Arial';
        $font = preg_replace('/[^a-zA-Z0-9 \-]/', '', $fontName);
        $font = PsdFontAssets::family($font);
        $weight = preg_match('/bold|black|heavy/i', $fontName) || ! empty($style['fauxBold']) ? 700 : 400;
        $fallback = preg_match('/cinzel|baskerville|playfair|garamond|times/i', $font) ? 'Georgia,serif' : 'Arial,sans-serif';
        $rules = 'font-family:&quot;'.$font.'&quot;,'.$fallback.';font-weight:'.$weight.';font-size:calc('.$size.' * var(--psd-unit));';
        $rules .= 'line-height:'.(! empty($style['leading']) ? 'calc('.(float) $style['leading'].' * var(--psd-unit))' : '1.25').';';
        if ($color = $this->color($style['fillColor'] ?? null)) {
            $rules .= 'color:'.$color.';';
        }
        if (! empty($style['fauxItalic']) || preg_match('/italic|oblique/i', $fontName)) {
            $rules .= 'font-style:italic;';
        }
        if (! empty($style['underline'])) {
            $rules .= 'text-decoration:underline;';
        }

        return $rules;
    }

    private function richText(array $layer): string
    {
        $text = $layer['text'];
        $base = $layer['textStyle'] ?? [];
        $runs = $base['styleRuns'] ?? [];
        if (! $runs) {
            $escaped = nl2br($this->escape($text));
            $font = $base['font']['name'] ?? $base['fontName'] ?? '';

            return preg_match('/bold|black|heavy/i', $font) || ! empty($base['fauxBold']) ? '<strong>'.$escaped.'</strong>' : $escaped;
        }
        $result = '';
        $offset = 0;
        // PSD run lengths are UTF-16 code units, matching Photoshop and JavaScript.
        $utf16 = mb_convert_encoding($text, 'UTF-16LE', 'UTF-8');
        foreach ($runs as $run) {
            $length = max(0, (int) ($run['length'] ?? 0));
            $slice = mb_convert_encoding(substr($utf16, $offset * 2, $length * 2), 'UTF-8', 'UTF-16LE');
            $runStyle = array_replace($base, $run['style'] ?? []);
            $bold = preg_match('/bold|black|heavy/i', $runStyle['font']['name'] ?? $runStyle['fontName'] ?? '') || ! empty($runStyle['fauxBold']);
            $runTag = $bold ? 'strong' : 'span';
            $result .= '<'.$runTag.' style="'.$this->textStyle($runStyle).'">'.nl2br($this->escape($slice)).'</'.$runTag.'>';
            $offset += $length;
        }
        $result .= nl2br($this->escape(mb_convert_encoding(substr($utf16, $offset * 2), 'UTF-8', 'UTF-16LE')));

        return $result;
    }

    private function fontSize(array $layer): float
    {
        $style = $layer['textStyle'] ?? [];

        return max(array_merge([(float) ($style['fontSize'] ?? 16)], array_map(fn ($run) => (float) ($run['style']['fontSize'] ?? 0), $style['styleRuns'] ?? [])));
    }

    private array $styles = [];

    private int $serial = 0;

    private bool $mainHeadingUsed = false;

    private float $designWidth = 1200;

    private string $primaryRole = 'banner';

    private function overlap(array $a, array $b): float
    {
        $area = max(0, min($a['right'], $b['right']) - max($a['left'], $b['left'])) * max(0, min($a['bottom'], $b['bottom']) - max($a['top'], $b['top']));

        return $area / max(1, min($a['width'] * $a['height'], $b['width'] * $b['height']));
    }

    private function contains(array $a, array $b): bool
    {
        return $b['left'] >= $a['left'] - 8 && $b['right'] <= $a['right'] + 8 && $b['top'] >= $a['top'] - 8 && $b['bottom'] <= $a['bottom'] + 8;
    }

    private function bounds(array $items): array
    {
        $left = min(array_column($items, 'left'));
        $top = min(array_column($items, 'top'));
        $right = max(array_column($items, 'right'));
        $bottom = max(array_column($items, 'bottom'));

        return compact('left', 'top', 'right', 'bottom') + ['width' => $right - $left, 'height' => $bottom - $top];
    }

    private function fieldName(string $text): ?string
    {
        $text = strtolower(trim($text));
        if (! preg_match('/^(?:your |enter |first name|last name|name\b|e-?mail\b|phone\b|subject\b|message\b|start writing)/', $text)) {
            return null;
        }
        if (str_starts_with($text, 'first name')) {
            return 'first_name';
        }
        if (str_starts_with($text, 'last name')) {
            return 'last_name';
        }

        return preg_match('/e-?mail/', $text) ? 'email' : (str_contains($text, 'message') ? 'message' : (str_contains($text, 'phone') ? 'phone' : (str_contains($text, 'subject') ? 'subject' : 'name')));
    }

    private function isAction(array $item): bool
    {
        return isset($item['text']) && $this->fontSize($item) < 40 && (bool) preg_match('/^(?:send|submit|learn more|read more|view more|buy|books$|contact$|call|live chat|consult|use coupon|book an appointment)/i', trim($item['text']));
    }

    private function controls(array $items): array
    {
        $used = [];
        $result = [];
        foreach ($items as $item) {
            if (! isset($item['text'])) {
                continue;
            }
            $field = $this->fieldName($item['text']);
            if (! $field && ! $this->isAction($item)) {
                continue;
            }
            $candidates = array_values(array_filter($items, fn ($shape) => ! isset($shape['text']) && isset($shape['shapeStyle']) && $shape['height'] >= 25 && $shape['height'] <= 350 && $shape['width'] <= $this->designWidth * .8 && $this->overlap($shape, $item) > .55));
            usort($candidates, fn ($a, $b) => $a['width'] * $a['height'] <=> $b['width'] * $b['height']);
            if ($candidates) {
                $shape = $candidates[0];
                $used[$shape['_id']] = true;
                $item = array_replace($item, array_intersect_key($shape, array_flip(['left', 'top', 'right', 'bottom', 'width', 'height', 'shapeStyle'])));
            }
            $item['kind'] = $field ? 'control' : 'button';
            $item['field'] = $field;
            $used[$item['_id']] = true;
            $result[] = $item;
        }
        // Some PSDs draw form boxes without any placeholder text. Recognize them inside contact sections.
        foreach ($items as $title) {
            if (! isset($title['text']) || ! preg_match('/^(?:contact us|write us a message|schedule a meeting)$/i', trim($title['text']))) {
                continue;
            }
            $boxes = array_values(array_filter($items, fn ($box) => ! isset($used[$box['_id']]) && isset($box['shapeStyle']) && $box['top'] > $title['bottom'] && $box['top'] < $title['bottom'] + 700 && $box['left'] >= $title['left'] - 40 && $box['right'] <= $title['left'] + $this->designWidth * .48 && $box['width'] >= 150 && $box['height'] >= 35 && $box['height'] <= 300));
            usort($boxes, fn ($a, $b) => ($a['top'] <=> $b['top']) ?: ($a['left'] <=> $b['left']));
            $knownFields = count(array_filter($result, fn ($field) => ($field['kind'] ?? '') === 'control' && $field['top'] > $title['bottom'] && $field['top'] < $title['bottom'] + 700));
            if (count($boxes) < 2 && ! $knownFields) {
                continue;
            }
            foreach ($boxes as $index => $box) {
                $field = $box['height'] > 130 ? 'message' : (['name', 'email', 'subject', 'phone'][$index] ?? 'field_'.($index + 1));
                $box['kind'] = 'control';
                $box['field'] = $field;
                $box['text'] = ucfirst(str_replace('_', ' ', $field));
                $box['inferred'] = true;
                $box['textStyle'] = ['fontName' => 'Garamond', 'fontSize' => 18];
                $used[$box['_id']] = true;
                $result[] = $box;
            }
        }

        return array_merge(array_values(array_filter($items, fn ($item) => ! isset($used[$item['_id']]))), $result);
    }

    private function figures(array $items): array
    {
        $used = [];
        $result = [];
        $images = array_values(array_filter($items, fn ($item) => ! isset($item['text']) && ! isset($item['shapeStyle']) && ! empty($item['imagePath']) && $item['width'] > 140 && $item['height'] > 120 && $item['width'] < $this->designWidth * .88));
        foreach ($images as $image) {
            if (isset($used[$image['_id']])) {
                continue;
            }
            $members = [$image];
            $used[$image['_id']] = true;
            foreach ($items as $other) {
                if (isset($used[$other['_id']]) || isset($other['kind']) || $this->overlap($image, $other) < .65) {
                    continue;
                }
                if (isset($other['text']) && ($this->fontSize($other) < 28 || mb_strlen($other['text']) > 160 || ! $this->contains($image, $other))) {
                    continue;
                }
                if (! isset($other['text']) && $other['height'] < 120) {
                    continue;
                }
                if ($other['width'] > $image['width'] * 1.3 || $other['height'] > $image['height'] * 1.3) {
                    continue;
                }
                $members[] = $other;
                $used[$other['_id']] = true;
            }
            usort($members, fn ($a, $b) => $a['order'] <=> $b['order']);
            $result[] = $this->bounds($members) + ['kind' => 'figure', 'children' => $members, '_id' => $image['_id'], 'order' => $image['order']];
        }

        return array_merge(array_values(array_filter($items, fn ($item) => ! isset($used[$item['_id']]))), $result);
    }

    private function cards(array $items): array
    {
        $used = [];
        $cards = [];
        $boxes = array_values(array_filter($items, fn ($box) => isset($box['shapeStyle']) && empty($box['kind']) && $box['width'] > 250 && $box['height'] > 180 && $box['width'] < $this->designWidth * .61));
        usort($boxes, fn ($a, $b) => $a['width'] * $a['height'] <=> $b['width'] * $b['height']);
        foreach ($boxes as $box) {
            if (isset($used[$box['_id']])) {
                continue;
            }
            $children = array_values(array_filter($items, fn ($item) => $item['_id'] !== $box['_id'] && ! isset($used[$item['_id']]) && $this->contains($box, $item) && (isset($item['text']) || isset($item['kind']) || (! isset($item['shapeStyle']) && $item['width'] < 120))));
            if (count($children) < 2) {
                continue;
            }
            $used[$box['_id']] = true;
            foreach ($children as $child) {
                $used[$child['_id']] = true;
            }
            $cards[] = $box + ['kind' => 'card', 'children' => $children];
        }

        return array_merge(array_values(array_filter($items, fn ($item) => ! isset($used[$item['_id']]))), $cards);
    }

    private function role(string $text): ?string
    {
        $text = preg_replace('/\s+/u', ' ', trim($text));
        foreach (['about-author' => '/^(?:about(?: the author| us)?|meet (?:the author|our team))$/i', 'books' => '/^(?:books(?: i.ve written)?|publications|my book|our books)$/iu', 'blogs' => '/^(?:blogs?|latest news|articles)$/i', 'testimonials' => '/^(?:happy people|testimonials|recent testimonials|reviews)$/i', 'newsletter' => '/newsletter/i', 'contact' => '/^(?:contact us|write us a message|get in touch|stay connected with us for any reason)$/i', 'footer' => '/^quick links$/i'] as $role => $pattern) {
            if (preg_match($pattern, $text)) {
                return $role;
            }
        }

        return null;
    }

    private function sections(array $document, array $items, float $headerEnd): array
    {
        $roots = $document['layers'] ?? [];
        $namedGroups = array_filter($roots, fn ($item) => ($item['type'] ?? '') === 'group' && ! preg_match('/^group(?:\s|$)/i', $item['name'] ?? ''));
        if ($namedGroups && count($namedGroups) === count($roots)) {
            $sections = [];
            foreach ($namedGroups as $group) {
                $sections[] = ['top' => (float) ($group['top'] ?? 0), 'role' => $this->role($group['name']) ?? (str_contains(strtolower($group['name']), 'hero') ? 'banner' : 'content'), 'name' => $group['name']];
            }
            usort($sections, fn ($a, $b) => $a['top'] <=> $b['top']);

            return $sections;
        }
        $sections = [['top' => $headerEnd, 'role' => 'banner', 'name' => 'Banner']];
        foreach ($items as $item) {
            if (! isset($item['text']) || $item['top'] < $headerEnd) {
                continue;
            }
            $role = $this->role($item['text']);
            if (! $role || ($this->fontSize($item) < 26 && ! ($role === 'footer' && $item['top'] > ($document['height'] ?? 800) * .8))) {
                continue;
            }
            $top = max($headerEnd, $item['top'] - 70);
            foreach ($items as $band) {
                if (isset($band['shapeStyle']) && $band['width'] > $this->designWidth * .6 && $band['height'] > 200 && abs($band['top'] - $item['top']) < 300) {
                    $top = min($top, max($headerEnd, $band['top']));
                }
                if ($role === 'about-author' && ($band['kind'] ?? '') === 'figure' && $band['top'] < $item['top'] && $band['top'] > $item['top'] - 500 && $band['right'] < $item['left'] + 40) {
                    $top = min($top, max($headerEnd, $band['top'] - 30));
                }
            }
            $existing = false;
            foreach ($sections as &$section) {
                if ($section['role'] === $role || abs($section['top'] - $top) < 250) {
                    if ($section['role'] === 'banner' && $top < $headerEnd + 250) {
                        $section = ['top' => $headerEnd, 'role' => $role, 'name' => trim($item['text'])];
                    }
                    $existing = true;
                    break;
                }
            }unset($section);
            if (! $existing) {
                $sections[] = ['top' => $top, 'role' => $role, 'name' => trim($item['text'])];
            }
        }
        usort($sections, fn ($a, $b) => $a['top'] <=> $b['top']);

        return $sections;
    }

    private function shapeCss(array $item): string
    {
        $style = $item['shapeStyle'] ?? [];
        $css = '';
        if ($color = $this->color($style['fillColor'] ?? null)) {
            $css .= 'background-color:'.$color.';';
        } elseif (isset($item['shapeStyle'])) {
            $css .= 'background-color:transparent;';
        }
        if ($stroke = $this->color($style['strokeColor'] ?? null)) {
            $css .= 'border:'.max(1, (float) ($style['strokeWidth'] ?? 1)).'px solid '.$stroke.';';
        }
        if (isset($style['radius'])) {
            $css .= 'border-radius:calc('.(float) $style['radius'].' * var(--psd-unit));';
        }

        return $css;
    }

    private function content(array $item, string $role, bool $inArtwork = false): string
    {
        $kind = $item['kind'] ?? 'text';
        if ($kind === 'figure') {
            $class = 'artwork-'.++$this->serial;
            $this->styles[] = '.'.$class.'{aspect-ratio:'.$item['width'].'/'.$item['height'].';max-width:calc('.$item['width'].' * var(--psd-unit))}';
            $html = '<figure class="artwork '.$class.'">';
            foreach ($item['children'] as $child) {
                $x = 100 * ($child['left'] - $item['left']) / max(1, $item['width']);
                $y = 100 * ($child['top'] - $item['top']) / max(1, $item['height']);
                $w = 100 * $child['width'] / max(1, $item['width']);
                $h = 100 * $child['height'] / max(1, $item['height']);
                $html .= '<div class="artwork-layer" style="left:'.$x.'%;top:'.$y.'%;width:'.$w.'%;height:'.$h.'%;opacity:'.($child['opacity'] ?? 1).'">'.$this->content($child, $role, true).'</div>';
            }

            return $html.'</figure>';
        }
        if ($kind === 'card') {
            return '<div class="content-card '.($this->hasControl($item['children']) ? 'contact-form' : 'testimonial-card').'" style="'.$this->shapeCss($item).'">'.$this->flow($item['children'], $role).'</div>';
        }
        if ($kind === 'control') {
            $name = $item['field'];
            $label = $this->escape(trim($item['text'] ?? ucfirst($name)));
            $id = 'field-'.++$this->serial;
            $color = $item['shapeStyle']['fillColor'] ?? ['r' => 255, 'g' => 255, 'b' => 255];
            $dark = (($color['r'] ?? 255) + ($color['g'] ?? 255) + ($color['b'] ?? 255)) < 350;
            $style = $this->shapeCss($item).'color:'.($dark ? '#fff' : '#212529').';--placeholder:'.($dark ? '#ddd' : '#666').';';
            $style .= 'min-height:calc('.max(44, $item['height']).' * var(--psd-unit));';
            $html = '<label class="visually-hidden" for="'.$id.'">'.$label.'</label>';
            if ($name === 'message') {
                $html .= '<textarea id="'.$id.'" name="message" class="form-control" rows="5" placeholder="'.$label.'" style="'.$style.'" required></textarea>';
            } else {
                $html .= '<input id="'.$id.'" name="'.$this->escape($name).'" type="'.($name === 'email' ? 'email' : ($name === 'phone' ? 'tel' : 'text')).'" class="form-control" placeholder="'.$label.'" style="'.$style.'" required>';
            }

            return $html;
        }
        if ($kind === 'button') {
            $submit = (bool) preg_match('/submit|send|book an appointment/i', $item['text']);

            return '<button type="'.($submit ? 'submit' : 'button').'" class="btn btn-web" style="'.$this->shapeCss($item).$this->textStyle($item['textStyle'] ?? []).'line-height:1.2;min-width:calc('.min(260, $item['width']).' * var(--psd-unit));min-height:calc('.max(44, $item['height']).' * var(--psd-unit));">'.$this->richText($item).'</button>';
        }
        if (isset($item['faqAnswer'])) {
            return '<details class="accordion-item" open><summary>'.$this->escape($item['faqQuestion']).'</summary><p>'.$this->escape($item['faqAnswer']).'</p></details>';
        }
        if (isset($item['text'])) {
            $size = $this->fontSize($item);
            $text = trim($item['text']);
            $tag = 'p';
            if (! $inArtwork && ! $this->mainHeadingUsed && $role === $this->primaryRole && $size >= 28 && mb_strlen($text) > 8) {
                $tag = 'h1';
                $this->mainHeadingUsed = true;
            } elseif ($size >= 42) {
                $tag = 'h2';
            } elseif ($size >= 28) {
                $tag = 'h3';
            } elseif ($size >= 24 && mb_strlen($text) < 90) {
                $tag = 'h4';
            } elseif (preg_match('/owner|author/i', $text) && mb_strlen($text) < 100) {
                $tag = 'h6';
            }
            $style = $this->textStyle($item['textStyle'] ?? []);
            $alignment = $item['textStyle']['justification'] ?? 'left';
            if (in_array($alignment, ['left', 'center', 'right', 'justify'])) {
                $style .= 'text-align:'.$alignment.';';
            }
            if ($tag === 'p' && mb_strlen($text) > 160) {
                $leading = (float) ($item['textStyle']['leading'] ?? ($size * 1.3));
                $lines = max(1, (int) ceil($item['height'] / max(1, $leading)));
                $style .= 'display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:'.$lines.';overflow:hidden;';
            }
            if (preg_match('/owner|author/i', $text) && mb_strlen($text) < 100 && str_contains($text, "\n")) {
                $parts = preg_split('/\r?\n/', $text, 2);

                return '<h5 class="person-caption" style="'.$style.'">'.$this->escape($parts[0]).'<span class="d-block">'.$this->escape($parts[1]).'</span></h5>';
            }
            $family = $item['textStyle']['fontName'] ?? $item['textStyle']['font']['name'] ?? '';
            $raster = ! empty($item['textImagePath']) && preg_match('/Duvall|Authentic|Mishella/i', $family);
            $body = $raster ? '<span class="visually-hidden">'.$this->escape($text).'</span><img class="signature-lettering" src="'.$this->escape($item['textImagePath']).'" alt="" aria-hidden="true">' : $this->richText($item);

            return '<'.$tag.' class="'.($inArtwork ? 'artwork-caption' : 'content-text').'" style="'.$style.'">'.$body.'</'.$tag.'>';
        }
        if ($inArtwork && isset($item['shapeStyle'])) {
            return '<div class="artwork-shape" aria-hidden="true" style="width:100%;height:100%;'.$this->shapeCss($item).'"></div>';
        }
        if (! empty($item['imagePath'])) {
            return '<img class="img-fluid '.($inArtwork ? 'artwork-image' : 'content-image').'" src="'.$this->escape($item['imagePath']).'" alt="'.$this->escape($item['name'] ?? '').'" loading="lazy">';
        }

        return '';
    }

    private function hasControl(array $items): bool
    {
        foreach ($items as $item) {
            if (($item['kind'] ?? '') === 'control' || (! empty($item['children']) && $this->hasControl($item['children']))) {
                return true;
            }
        }

        return false;
    }

    private function flow(array $items, string $role): string
    {
        usort($items, fn ($a, $b) => ($a['top'] <=> $b['top']) ?: ($a['left'] <=> $b['left']));
        $html = '';
        $pending = [];
        foreach ($items as $item) {
            if (isset($item['shapeStyle']) && empty($item['kind'])) {
                continue;
            }
            $kind = $item['kind'] ?? '';
            if ($kind === 'control' || $kind === 'button') {
                $pending[] = $item;

                continue;
            }
            if ($pending) {
                $html .= $this->controlRows($pending, $role);
                $pending = [];
            }
            $html .= '<div class="content-block">'.$this->content($item, $role).'</div>';
        }
        if ($pending) {
            $html .= $this->controlRows($pending, $role);
        }

        return $html;
    }

    private function controlRows(array $items, string $role): string
    {
        $rows = [];
        foreach ($items as $item) {
            $last = count($rows) - 1;
            if ($last < 0 || abs($rows[$last][0]['top'] - $item['top']) > 25) {
                $rows[] = [$item];
            } else {
                $rows[$last][] = $item;
            }
        }
        $html = '';
        foreach ($rows as $row) {
            if (count(array_filter($row, fn ($item) => ($item['kind'] ?? '') === 'button')) === count($row)) {
                $html .= '<div class="d-flex flex-wrap gap-3 control-row">';
                foreach ($row as $item) {
                    $html .= $this->content($item, $role);
                }
                $html .= '</div>';

                continue;
            }
            $html .= '<div class="row g-3 control-row">';
            $span = count($row) > 1 ? max(3, (int) floor(12 / count($row))) : 12;
            foreach ($row as $item) {
                $html .= '<div class="col-lg-'.$span.' col-md-'.$span.' col-12">'.$this->content($item, $role).'</div>';
            }
            $html .= '</div>';
        }

        return $html;
    }

    private function columns(array $items, string $role): string
    {
        if (! $items) {
            return '';
        }
        $clusters = [];
        usort($items, fn ($a, $b) => $a['left'] <=> $b['left']);
        foreach ($items as $item) {
            if (isset($item['shapeStyle']) && empty($item['kind'])) {
                continue;
            }
            $assigned = false;
            foreach ($clusters as &$cluster) {
                $intersection = min($cluster['right'], $item['right']) - max($cluster['left'], $item['left']);
                if ($intersection > min($cluster['width'], $item['width']) * .18 || abs($cluster['left'] - $item['left']) < 70) {
                    $cluster['items'][] = $item;
                    $cluster['left'] = min($cluster['left'], $item['left']);
                    $cluster['right'] = max($cluster['right'], $item['right']);
                    $cluster['width'] = $cluster['right'] - $cluster['left'];
                    $assigned = true;
                    break;
                }
            }unset($cluster);
            if (! $assigned) {
                $clusters[] = ['left' => $item['left'], 'right' => $item['right'], 'width' => $item['width'], 'items' => [$item]];
            }
        }
        if (count($clusters) > 4) {
            $clusters = [['width' => $this->designWidth, 'items' => $items]];
        }
        $html = '<div class="row align-items-center g-4">';
        $count = count($clusters);
        $remaining = 12;
        $total = array_sum(array_column($clusters, 'width')) ?: 1;
        foreach ($clusters as $index => $cluster) {
            $span = $index === $count - 1 ? $remaining : max(2, min($remaining - 2 * ($count - $index - 1), (int) round(12 * $cluster['width'] / $total)));
            $remaining -= $span;
            $html .= '<div class="col-lg-'.$span.' col-md-'.($count > 1 ? '6' : '12').' col-12"><div class="'.$role.'-content">'.$this->flow($cluster['items'], $role).'</div></div>';
        }

        return $html.'</div>';
    }

    public function render(array $document): array
    {
        $this->serial = 0;
        $this->mainHeadingUsed = false;
        $this->designWidth = max(1, (float) ($document['width'] ?? 1200));
        $width = $this->designWidth;
        $height = max(1, (float) ($document['height'] ?? 800));
        $this->styles = [':root{--psd-unit:min(calc(100vw / '.$width.'),1px);--design-width:'.$width.'px}',
            '*{box-sizing:border-box}body{margin:0;background:#fff;color:#212529;font-family:Georgia,serif}.container{max-width:calc('.round($width * .8).' * var(--psd-unit));width:calc(100% - 40px)}main{overflow:hidden}section{padding:calc(60 * var(--psd-unit)) 0}h1,h2,h3,h4,h5,h6,p,figure{margin:0}h1,h2,h3,h4,h5,h6,p{white-space:normal;overflow-wrap:normal}.content-block+.content-block{margin-top:calc(22 * var(--psd-unit))}.content-image{max-width:100%;height:auto}.btn-web{border:1px solid currentColor;border-radius:0;min-height:44px;padding:12px 26px;max-width:100%}.control-row{margin-top:18px}.form-control{border-radius:0;min-height:48px;border:1px solid #777;padding:14px 18px;font-family:inherit;font-size:16px}.form-control::placeholder{color:var(--placeholder,#666);opacity:1}.content-card{padding:calc(40 * var(--psd-unit));height:100%}.artwork{position:relative;width:100%;margin-inline:auto}.artwork-layer{position:absolute;pointer-events:none}.artwork-image{display:block;width:100%;height:100%;object-fit:fill}.artwork-caption{width:100%;height:100%;white-space:nowrap;transform-origin:center top}.section-heading{text-align:center;margin-bottom:calc(45 * var(--psd-unit))}.section-heading h2{display:inline-block}.site-header{padding:24px 0}.brand-image{display:block;max-width:calc(505 * var(--psd-unit));max-height:110px;width:100%;object-fit:contain;margin:auto}.site-nav{display:flex;justify-content:center;flex-wrap:wrap;gap:18px 32px;margin-top:24px}.site-nav a{color:inherit;text-decoration:none}.banner{padding-top:calc(75 * var(--psd-unit));padding-bottom:calc(100 * var(--psd-unit))}.signature-lettering{display:block;max-width:100%;height:auto}.export-form-status{background:white;color:#222;padding:1rem}.newsletter .container{max-width:1100px}.newsletter .row{justify-content:center}.footer .content-text{line-height:1.6!important}'];
        $items = $this->leaves($document['layers'] ?? []);
        foreach ($items as $id => &$item) {
            $item['_id'] = $id;
            $item['order'] = $id;
        }unset($item);
        $items = array_values(array_filter($items, fn ($item) => empty($item['documentBackground']) && $item['right'] > 0 && $item['left'] < $width && $item['bottom'] > 0 && $item['top'] < $height && ($item['opacity'] ?? 1) > .025));
        if (! $items) {
            if (empty($document['compositePath'])) {
                throw new \RuntimeException('PSD contains no readable content.');
            }

            return $this->package('<section class="banner"><div class="container"><div class="row"><div class="col-lg-12 col-md-12 col-12"><img class="img-fluid" src="'.$this->escape($document['compositePath']).'" alt="Flattened PSD design"></div></div></div></section>', 'Flattened PSD: exported its image. Editable text requires a layered PSD.');
        }
        if (! empty($document['backgroundPath'])) {
            $this->styles[] = 'body{background-image:url("../../'.$this->escape($document['backgroundPath']).'");background-size:100% auto;background-repeat:repeat-y}';
        }
        $baseText = array_values(array_filter($items, fn ($item) => isset($item['text']) && $this->fontSize($item) >= 14));
        if ($baseText) {
            $base = $baseText[0]['textStyle']['fillColor'] ?? null;
            if ($base) {
                $this->styles[] = 'body{color:'.$this->color($base).'}';
            }
        }
        $items = $this->controls($items);
        $items = $this->figures($items);
        $headerEnd = 0;
        $header = '';
        $nav = null;
        foreach ($items as $item) {
            if (isset($item['text']) && $item['top'] < 200 && preg_match('/home\s{2,}.*about/i', $item['text'])) {
                $nav = $item;
            }
        }
        if ($nav) {
            $headerEnd = max(180, $nav['bottom'] + 35);
            $logos = array_values(array_filter($items, fn ($item) => ! isset($item['text']) && ! empty($item['imagePath']) && $item['top'] < 100 && $item['width'] > 200 && $item['height'] < 150));
            $header = '<header class="site-header"><div class="container"><div class="row"><div class="col-lg-12 col-md-12 col-12">';
            if ($logos) {
                $header .= '<img class="brand-image" src="'.$this->escape($logos[0]['imagePath']).'" alt="Website logo">';
            }
            $header .= '<nav class="site-nav" aria-label="Main navigation" style="'.$this->textStyle($nav['textStyle'] ?? []).'">';
            foreach (preg_split('/\s{3,}|\t+/u', trim($nav['text'])) as $label) {
                $target = $this->role($label) ?? (preg_match('/about/i', $label) ? 'about-author' : (preg_match('/contact/i', $label) ? 'contact' : 'banner'));
                $header .= '<a href="#'.$target.'">'.$this->escape(trim($label)).'</a>';
            }
            $header .= '</nav></div></div></div></header>';
            $items = array_values(array_filter($items, fn ($item) => $item['top'] >= $headerEnd));
        }
        $sections = $this->sections($document, $items, $headerEnd);
        $this->primaryRole = $sections[0]['role'] ?? 'banner';
        $body = $header.'<main>';
        foreach ($sections as $index => $section) {
            $bottom = $sections[$index + 1]['top'] ?? $height;
            $role = $section['role'];
            $members = array_values(array_filter($items, fn ($item) => $item['top'] >= $section['top'] && $item['top'] < $bottom));
            $bands = array_values(array_filter($members, fn ($item) => isset($item['shapeStyle']) && $item['width'] > $width * .6 && $item['height'] > 200));
            $style = '';
            if ($bands) {
                $style = $this->shapeCss($bands[0]);
            }
            $sidePanels = array_values(array_filter($members, fn ($item) => isset($item['shapeStyle']) && $item['height'] > 300 && abs($item['top'] - $section['top']) < 80));
            $leftPanel = null;
            $rightPanel = null;
            foreach ($sidePanels as $panel) {
                if ($panel['left'] <= 10 && $panel['width'] < $width * .8) {
                    $leftPanel = $panel;
                }
                if ($panel['right'] >= $width - 10 && $panel['width'] < $width * .8) {
                    $rightPanel = $panel;
                }
            }
            if ($leftPanel && $rightPanel && ($leftColor = $this->color($leftPanel['shapeStyle']['fillColor'] ?? null)) && ($rightColor = $this->color($rightPanel['shapeStyle']['fillColor'] ?? null))) {
                $split = round(100 * $leftPanel['right'] / $width, 3);
                $style = 'background:linear-gradient(90deg,'.$leftColor.' 0%,'.$leftColor.' '.$split.'%,'.$rightColor.' '.$split.'%,'.$rightColor.' 100%);';
            }

            $members = array_values(array_filter($members, fn ($item) => ! in_array($item, $bands, true)));
            $heading = null;
            foreach ($members as $key => $item) {
                if (isset($item['text']) && $this->role($item['text']) === $role && abs(($item['left'] + $item['width'] / 2) - $width / 2) < $width * .1) {
                    $heading = $item;
                    unset($members[$key]);
                    break;
                }
            }
            // Small ornament layers belong with the heading, rather than becoming empty Bootstrap columns.
            if ($heading) {
                $members = array_filter($members, fn ($item) => ! (empty($item['text']) && empty($item['kind']) && $item['height'] < 120 && abs($item['top'] - $heading['top']) < 100));
            }
            $members = $this->cards(array_values($members));
            $hasForm = $this->hasControl($members);
            $body .= '<section id="'.$role.'" class="'.$role.'" style="'.$style.'"><div class="container">';
            if ($heading) {
                $body .= '<div class="row"><div class="col-lg-12 col-md-12 col-12"><div class="section-heading">'.$this->content($heading, $role).'</div></div></div>';
            }
            if ($hasForm) {
                $body .= '<form class="'.$role.'-form" data-export-form>';
            }
            $body .= $this->columns($members, $role);
            if ($hasForm) {
                $body .= '</form>';
            }
            $body .= '</div></section>';
        }
        $body .= '</main>';
        $this->styles[] = '@media(max-width:767.98px){:root{--psd-unit:.65px}.container{max-width:none;width:calc(100% - 32px)}section{padding:38px 0}.site-header{padding:18px 0}.site-nav{gap:12px 18px}.content-text{font-size:clamp(16px,4.5vw,30px)!important;line-height:1.45!important}.content-text span,.content-text strong{font-size:inherit!important;line-height:inherit!important}.artwork-caption{line-height:1.2!important}.content-card{padding:24px}.control-row .col-12{width:100%}.banner{padding:30px 0 50px}.form-control{min-height:48px!important}.section-heading{margin-bottom:28px}}';

        for ($scale = 60; $scale <= 100; $scale += 5) {
            $this->styles[] = '.text-fit-'.$scale.'{transform:scaleX('.($scale / 100).')}';
        }

        return $this->package($body, 'Generated semantic Bootstrap sections and responsive content columns. Local font files are included where available; custom signature lettering uses its saved PSD artwork. Compare with reference.html.');
    }

    private function package(string $body, string $message): array
    {
        $html = '<!DOCTYPE html>'."\n".'<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Converted PSD website</title><link rel="stylesheet" href="assets/css/bootstrap.min.css"><link rel="stylesheet" href="assets/css/style.css"></head><body>'.$body.'<script src="assets/js/bootstrap.bundle.min.js"></script><script src="assets/js/main.js"></script></body></html>';
        $js = "document.fonts.ready.then(()=>document.querySelectorAll('.artwork-caption').forEach(node=>{if(node.scrollWidth>node.clientWidth&&node.clientWidth>0)node.classList.add('text-fit-'+Math.max(60,Math.floor(100*node.clientWidth/node.scrollWidth/5)*5))}));document.querySelectorAll('[data-export-form]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;let status=form.querySelector('[role=status]');if(!status){status=document.createElement('p');status.setAttribute('role','status');status.className='export-form-status';form.append(status)}status.textContent='This exported form needs a submission endpoint before messages can be sent.';}));";

        return ['html' => $html, 'css' => implode("\n", $this->styles), 'js' => $js, 'message' => $message];
    }
}

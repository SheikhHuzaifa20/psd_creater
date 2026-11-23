<?php

namespace App\Services;

class ExternalCss
{
    public function apply(array $result): array
    {
        $css = $result['css'];
        $result['html'] = preg_replace_callback('/<style\b[^>]*>([\s\S]*?)<\/style>/i', function ($match) use (&$css) {
            $css .= "\n".$match[1];

            return '';
        }, $result['html']);
        $rules = [];
        $index = 0;
        $result['html'] = preg_replace_callback('/<[a-z][^>]*>/i', function ($tag) use (&$css, &$rules, &$index) {
            $html = $tag[0];
            if (! preg_match('/\sstyle\s*=\s*(["\'])(.*?)\1/is', $html, $style)) {
                return $html;
            }
            $declarations = html_entity_decode($style[2], ENT_QUOTES | ENT_HTML5);
            $class = $rules[$declarations] ??= 'export-style-'.++$index;
            $html = str_replace($style[0], '', $html);
            if (preg_match('/\sclass\s*=\s*(["\'])(.*?)\1/is', $html)) {
                $html = preg_replace_callback('/\sclass\s*=\s*(["\'])(.*?)\1/is', fn ($match) => ' class="'.$match[2].' '.$class.'"', $html, 1);
            } else {
                $html = preg_replace('/^<([a-z][a-z0-9-]*)/i', '<$1 class="'.$class.'"', $html, 1);
            }

            return $html;
        }, $result['html']);
        foreach ($rules as $declarations => $class) {
            $css .= "\n.".$class.'{'.$declarations.'}';
        }
        $result['css'] = $css;

        return $result;
    }
}

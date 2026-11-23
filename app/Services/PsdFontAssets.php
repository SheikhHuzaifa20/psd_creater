<?php

namespace App\Services;

use Illuminate\Support\Facades\File;

class PsdFontAssets
{
    public const FAMILIES = [
        'CinzelDecorative' => ['Cinzel Decorative', 'CinzelDecorative-Regular.ttf', 'cinzeldecorative'],
        'PlayfairDisplay' => ['Playfair Display', 'PlayfairDisplay.ttf', 'playfairdisplay'],
        'LibreBaskerville' => ['Libre Baskerville', 'LibreBaskerville.ttf', 'librebaskerville'],
        'Manrope' => ['Manrope', 'Manrope.ttf', 'manrope'],
        'GreatVibes' => ['Great Vibes', 'GreatVibes-Regular.ttf', 'greatvibes'],
        'Cabin' => ['Cabin', 'Cabin.ttf', 'cabin'],
    ];

    public static function family(string $name): string
    {
        $base = preg_replace('/[- ]?(?:BoldItalic|BoldMT|SemiBold|ExtraBold|Regular|Medium|Light|Italic|Bold|MT)$/i', '', $name);

        return self::FAMILIES[$base][0] ?? $base;
    }

    public static function hasWebFont(string $name): bool
    {
        return in_array(self::family($name), array_column(self::FAMILIES, 0), true);
    }

    public function prepare(array $document, string $output): string
    {
        $names = [];
        $walk = function (array $layers) use (&$walk, &$names) {
            foreach ($layers as $layer) {
                foreach (array_merge([$layer['textStyle'] ?? []], array_map(fn ($run) => $run['style'] ?? [], $layer['textStyle']['styleRuns'] ?? [])) as $style) {
                    $name = $style['font']['name'] ?? $style['fontName'] ?? null;
                    if ($name) {
                        $names[] = self::family($name);
                    }
                }
                $walk($layer['children'] ?? []);
            }
        };
        $walk($document['layers'] ?? []);
        $css = '';
        foreach (self::FAMILIES as [$family,$file,$license]) {
            if (! in_array($family, $names, true) || ! is_file(resource_path('fonts/'.$file))) {
                continue;
            }
            File::ensureDirectoryExists($output.'/assets/fonts');
            File::copy(resource_path('fonts/'.$file), $output.'/assets/fonts/'.$file);
            if (is_file(resource_path('fonts/'.$license.'-OFL.txt'))) {
                File::copy(resource_path('fonts/'.$license.'-OFL.txt'), $output.'/assets/fonts/'.$license.'-OFL.txt');
            }
            $weight = str_contains($file, '-Regular') ? '400' : '100 900';
            $css .= '@font-face{font-family:"'.$family.'";src:url("../fonts/'.$file.'") format("truetype");font-weight:'.$weight.';font-style:normal;font-display:swap}'."\n";
        }

        return $css;
    }
}

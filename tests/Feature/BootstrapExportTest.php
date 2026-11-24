<?php

namespace Tests\Feature;

use App\Services\PsdFontAssets;
use App\Services\PsdWebsiteGenerator;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class BootstrapExportTest extends TestCase
{
    public function test_mixed_type_styles_and_sections_are_preserved_without_absolute_page_layout(): void
    {
        $doc = ['width' => 1200, 'height' => 1600, 'layers' => [
            ['type' => 'group', 'name' => 'Hero', 'left' => 0, 'top' => 0, 'right' => 1200, 'bottom' => 700, 'width' => 1200, 'height' => 700, 'children' => [
                ['type' => 'text', 'name' => 'Headline', 'text' => 'Hello World', 'left' => 100, 'top' => 100, 'right' => 800, 'bottom' => 180, 'width' => 700, 'height' => 80, 'textStyle' => ['styleRuns' => [
                    ['length' => 6, 'style' => ['fontSize' => 48, 'font' => ['name' => 'Arial-BoldMT'], 'fillColor' => ['r' => 0, 'g' => 0, 'b' => 0]]],
                    ['length' => 5, 'style' => ['fontSize' => 48, 'fillColor' => ['r' => 0, 'g' => 109, 'b' => 233]]],
                ]]],
            ]],
            ['type' => 'group', 'name' => 'About', 'left' => 0, 'top' => 800, 'right' => 1200, 'bottom' => 1600, 'width' => 1200, 'height' => 800, 'children' => [
                ['type' => 'text', 'name' => 'Description', 'text' => 'About this design', 'left' => 100, 'top' => 900, 'right' => 700, 'bottom' => 950, 'width' => 600, 'height' => 50],
            ]],
        ]];
        $result = app(PsdWebsiteGenerator::class)->render($doc);
        $this->assertSame(2, substr_count($result['html'], '<section'));
        $this->assertSame(1, substr_count($result['html'], '<h1'));
        $this->assertStringContainsString('rgb(0,109,233)', $result['html'].$result['css']);
        $this->assertStringContainsString('font-weight:700', $result['html'].$result['css']);
        $this->assertDoesNotMatchRegularExpression('/\.(?:container|row|content-block)\s*\{[^}]*position:\s*absolute/', $result['css']);
        $this->assertStringContainsString('@media', $result['css']);
    }

    public function test_flattened_composite_is_explicitly_reported(): void
    {
        $result = app(PsdWebsiteGenerator::class)->render(['width' => 800, 'height' => 600, 'layers' => [], 'compositePath' => 'assets/images/original-design.png']);
        $this->assertStringContainsString('Flattened PSD', $result['message']);
    }

    public function test_newsletter_and_unlabelled_contact_boxes_become_editable_fields_in_bootstrap_columns(): void
    {
        $text = fn ($name, $value, $x, $y, $w = 500, $h = 40, $font = 24) => ['type' => 'text', 'name' => $name, 'text' => $value, 'left' => $x, 'top' => $y, 'width' => $w, 'height' => $h, 'right' => $x + $w, 'bottom' => $y + $h, 'textStyle' => ['fontSize' => $font, 'fontName' => 'Garamond']];
        $shape = fn ($name, $x, $y, $w, $h) => ['type' => 'image', 'name' => $name, 'left' => $x, 'top' => $y, 'width' => $w, 'height' => $h, 'right' => $x + $w, 'bottom' => $y + $h, 'shapeStyle' => ['fillColor' => ['r' => 0, 'g' => 0, 'b' => 0]]];
        $doc = ['width' => 1920, 'height' => 2000, 'layers' => [
            $text('Title', 'Our newsletter', 600, 100, 700, 70, 64),
            $text('Label', 'Enter your e-mail', 500, 250, 300, 40, 20),
            $shape('Rectangle email', 450, 230, 650, 70),
            $text('Action', 'Submit', 1200, 250, 120, 40, 20),
            $text('Contact title', 'Contact Us', 300, 900, 500, 70, 64),
            $shape('Field 1', 300, 1050, 350, 70), $shape('Field 2', 680, 1050, 350, 70),
            $shape('Field 3', 300, 1150, 730, 70), $shape('Field 4', 300, 1250, 730, 230),
            $text('Action', 'Book an appointment', 300, 1530, 500, 50, 20),
        ]];
        $result = app(PsdWebsiteGenerator::class)->render($doc);
        $this->assertStringContainsString('type="email"', $result['html']);
        $this->assertStringContainsString('<textarea', $result['html']);
        $this->assertStringContainsString('name="name"', $result['html']);
        $this->assertStringContainsString('col-md-', $result['html']);
        $this->assertStringNotContainsString('grid-template-rows:', $result['css']);
        $this->assertStringNotContainsString('white-space:pre-wrap', $result['css']);
    }

    public function test_smart_apostrophes_do_not_merge_the_books_section_into_about(): void
    {
        $title = json_decode('"Books I\u2019ve Written"');
        $text = fn ($value, $y) => ['type' => 'text', 'name' => $value, 'text' => $value, 'left' => 500, 'top' => $y, 'width' => 700, 'height' => 80, 'textStyle' => ['fontSize' => 60]];
        $result = app(PsdWebsiteGenerator::class)->render(['width' => 1920, 'height' => 4000, 'layers' => [$text('A real headline', 100), $text('About The Author', 1300), $text($title, 2200)]]);
        $this->assertStringContainsString('id="books"', $result['html']);
        $this->assertStringContainsString('id="about-author"', $result['html']);
    }

    public function test_available_psd_font_is_packaged_with_its_license(): void
    {
        $output = storage_path('app/temp/font-check-'.bin2hex(random_bytes(8)));
        File::ensureDirectoryExists($output);
        try {
            $css = app(PsdFontAssets::class)->prepare(['layers' => [['textStyle' => ['fontName' => 'CinzelDecorative-Regular']]]], $output);
            $this->assertStringContainsString('font-family:"Cinzel Decorative"', $css);
            $this->assertFileExists($output.'/assets/fonts/CinzelDecorative-Regular.ttf');
            $this->assertFileExists($output.'/assets/fonts/cinzeldecorative-OFL.txt');
        } finally {
            File::deleteDirectory($output);
        }
    }

    public function test_export_has_external_css_only(): void
    {
        $doc = ['width' => 800, 'height' => 600, 'layers' => [['type' => 'text', 'name' => 'Headline', 'text' => 'Clean HTML', 'left' => 50, 'top' => 100, 'width' => 650, 'height' => 70, 'textStyle' => ['fontSize' => 48, 'fillColor' => ['r' => 0, 'g' => 109, 'b' => 233]]]]];
        $result = app(PsdWebsiteGenerator::class)->render($doc);
        $this->assertDoesNotMatchRegularExpression('/\sstyle\s*=|<style\b/i', $result['html']);
        $this->assertStringContainsString('rgb(0,109,233)', $result['css']);
        $this->assertStringContainsString('export-style-', $result['html']);
    }

    public function test_contact_information_is_not_mistaken_for_form_labels(): void
    {
        $layers = [];
        foreach (["Phone\nLandline: 123-456-789", "Email\nContact@domain.com"] as $i => $value) {
            $layers[] = ['type' => 'text', 'name' => 'Contact detail', 'text' => $value, 'left' => 800, 'top' => 500 + $i * 100, 'width' => 300, 'height' => 70, 'textStyle' => ['fontSize' => 18]];
        }
        $result = app(PsdWebsiteGenerator::class)->render(['width' => 1200, 'height' => 1000, 'layers' => $layers]);
        $this->assertStringNotContainsString('<input', $result['html']);
        $this->assertStringContainsString('Contact@domain.com', $result['html']);
    }

    public function test_later_black_cta_does_not_turn_the_hero_black(): void
    {
        $result = app(PsdWebsiteGenerator::class)->render(['width' => 1200, 'height' => 2400, 'layers' => [
            ['type' => 'image', 'name' => 'Rectangle hero', 'left' => 0, 'top' => 0, 'right' => 1200, 'bottom' => 800, 'width' => 1200, 'height' => 800, 'shapeStyle' => ['fillColor' => ['r' => 250, 'g' => 250, 'b' => 250]]],
            ['type' => 'text', 'name' => 'Heading', 'text' => 'Main headline', 'left' => 200, 'top' => 100, 'right' => 1000, 'bottom' => 180, 'width' => 800, 'height' => 80, 'textStyle' => ['fontSize' => 60]],
            ['type' => 'image', 'name' => 'Rectangle CTA', 'left' => 0, 'top' => 1200, 'right' => 1200, 'bottom' => 1500, 'width' => 1200, 'height' => 300, 'shapeStyle' => ['fillColor' => ['r' => 0, 'g' => 0, 'b' => 0]]],
            ['type' => 'text', 'name' => 'CTA', 'text' => 'Call our team', 'left' => 200, 'top' => 1300, 'right' => 1000, 'bottom' => 1350, 'width' => 800, 'height' => 50, 'textStyle' => ['fontSize' => 32]],
        ]]);
        preg_match('/<section id="banner"[^>]*class="([^"]+)"/', $result['html'], $match);
        $classes = explode(' ', $match[1]);
        $styleClass = end($classes);
        preg_match('/\.'.preg_quote($styleClass, '/').'\{([^}]+)\}/', $result['css'], $rule);
        $this->assertStringContainsString('rgb(250,250,250)', $rule[1]);
        $this->assertStringContainsString('Main headline', $result['html']);
    }

    public function test_button_style_runs_share_a_single_label_box(): void
    {
        $result = app(PsdWebsiteGenerator::class)->render(['width' => 800, 'height' => 600, 'layers' => [['type' => 'text', 'name' => 'Action', 'text' => 'Learn More', 'left' => 50, 'top' => 100, 'width' => 180, 'height' => 40, 'textStyle' => ['fontSize' => 18, 'styleRuns' => [['length' => 1, 'style' => ['fontSize' => 18]], ['length' => 9, 'style' => ['fontSize' => 18]]]]]]]);
        $this->assertStringContainsString('class="button-label"', $result['html']);
        $this->assertDoesNotMatchRegularExpression('/\sstyle\s*=|<style\b/i', $result['html']);
    }
}

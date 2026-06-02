<?php

namespace Tests\Unit;

use App\Models\Stock;
use Tests\TestCase;

class StockParseSearchQueryTest extends TestCase
{
    // Standard format: 205/55R16
    public function test_standard_format_with_slash(): void
    {
        $result = Stock::parseSearchQuery('205/55R16');

        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertSame(16, $result['diameter']);
        $this->assertNull($result['brand_prefix']);
        $this->assertSame([], $result['text']);
    }

    // Standard format without slash: 20555R16
    public function test_standard_format_without_slash(): void
    {
        $result = Stock::parseSearchQuery('20555R16');

        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertSame(16, $result['diameter']);
    }

    // Standard format without height: 205R16
    public function test_standard_format_without_height(): void
    {
        $result = Stock::parseSearchQuery('205R16');

        $this->assertSame(205, $result['width']);
        $this->assertNull($result['height']);
        $this->assertSame(16, $result['diameter']);
    }

    // Standard format case-insensitive: 225/45r17
    public function test_standard_format_lowercase_r(): void
    {
        $result = Stock::parseSearchQuery('225/45r17');

        $this->assertSame(225, $result['width']);
        $this->assertSame(45, $result['height']);
        $this->assertSame(17, $result['diameter']);
    }

    // Reference-style with 7+ digits: M2055516
    public function test_reference_style_with_7_digits(): void
    {
        $result = Stock::parseSearchQuery('M2055516');

        $this->assertSame('M', $result['brand_prefix']);
        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertSame(16, $result['diameter']);
    }

    // Reference-style with multi-letter prefix: MIC2055516
    public function test_reference_style_with_multi_letter_prefix(): void
    {
        $result = Stock::parseSearchQuery('MIC2055516');

        $this->assertSame('MIC', $result['brand_prefix']);
        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertSame(16, $result['diameter']);
    }

    // Reference-style with 5 digits: B20555
    public function test_reference_style_with_5_digits(): void
    {
        $result = Stock::parseSearchQuery('B20555');

        $this->assertSame('B', $result['brand_prefix']);
        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertNull($result['diameter']);
    }

    // Pure digits >= 7: 2055516
    public function test_pure_digits_7_chars(): void
    {
        $result = Stock::parseSearchQuery('2055516');

        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertSame(16, $result['diameter']);
        $this->assertNull($result['brand_prefix']);
    }

    // Pure digits with more than 7 digits: 20555165 (width=205, height=55, diameter=165)
    public function test_pure_digits_more_than_7_chars(): void
    {
        $result = Stock::parseSearchQuery('20555165');

        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertSame(165, $result['diameter']);
    }

    // Pure digits 5 chars: 20555
    public function test_pure_digits_5_chars(): void
    {
        $result = Stock::parseSearchQuery('20555');

        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertNull($result['diameter']);
    }

    // Pure digits 6 chars: 205551 (>= 5 so width+height)
    public function test_pure_digits_6_chars(): void
    {
        $result = Stock::parseSearchQuery('205551');

        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertNull($result['diameter']);
    }

    // Pure digits 3 chars: 205
    public function test_pure_digits_3_chars(): void
    {
        $result = Stock::parseSearchQuery('205');

        $this->assertSame(205, $result['width']);
        $this->assertNull($result['height']);
        $this->assertNull($result['diameter']);
    }

    // Pure digits 2 chars: 16
    public function test_pure_digits_2_chars(): void
    {
        $result = Stock::parseSearchQuery('16');

        $this->assertNull($result['width']);
        $this->assertNull($result['height']);
        $this->assertSame(16, $result['diameter']);
    }

    // Text term falls into text array
    public function test_text_term(): void
    {
        $result = Stock::parseSearchQuery('Michelin');

        $this->assertSame(['Michelin'], $result['text']);
        $this->assertNull($result['width']);
        $this->assertNull($result['height']);
        $this->assertNull($result['diameter']);
        $this->assertNull($result['brand_prefix']);
    }

    // Multiple tokens: dimension + text
    public function test_multiple_tokens_dimension_and_text(): void
    {
        $result = Stock::parseSearchQuery('205/55R16 Michelin');

        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertSame(16, $result['diameter']);
        $this->assertSame(['Michelin'], $result['text']);
    }

    // Multiple text tokens
    public function test_multiple_text_tokens(): void
    {
        $result = Stock::parseSearchQuery('Michelin Primacy');

        $this->assertSame(['Michelin', 'Primacy'], $result['text']);
    }

    // Input with extra whitespace is trimmed and split correctly
    public function test_whitespace_is_ignored(): void
    {
        $result = Stock::parseSearchQuery('  205/55R16  ');

        $this->assertSame(205, $result['width']);
        $this->assertSame(55, $result['height']);
        $this->assertSame(16, $result['diameter']);
    }

    // Empty string returns null fields and empty text
    public function test_empty_string(): void
    {
        $result = Stock::parseSearchQuery('');

        $this->assertNull($result['width']);
        $this->assertNull($result['height']);
        $this->assertNull($result['diameter']);
        $this->assertNull($result['brand_prefix']);
        $this->assertSame([], $result['text']);
    }
}

<?php

namespace App\Console\Commands;

use App\Models\Stock;
use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ImportStockCommand extends Command
{
    protected $signature = 'stock:import {file : Path to the XLSX file}';

    protected $description = 'Import stock from an Excel file';

    public function handle(): int
    {
        $path = $this->argument('file');

        if (! file_exists($path)) {
            $this->error("File not found: {$path}");
            return self::FAILURE;
        }

        $spreadsheet = IOFactory::load($path);
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, true);

        // Remove header row
        array_shift($rows);

        $count = 0;

        foreach (array_chunk($rows, 100) as $chunk) {
            $records = [];
            foreach ($chunk as $row) {
                $dimension = trim($row['C'] ?? '');
                $parsed = Stock::parseDimension($dimension);
                $qty = is_numeric($row['M'] ?? null) ? (int) $row['M'] : 0;

                $records[] = [
                    'brand' => trim($row['A'] ?? '') ?: null,
                    'profile' => trim($row['B'] ?? '') ?: null,
                    'dimension' => $dimension ?: null,
                    'width' => $parsed['width'],
                    'height' => $parsed['height'],
                    'diameter' => $parsed['diameter'],
                    'ic' => isset($row['D']) ? trim((string) $row['D']) ?: null : null,
                    'iv' => isset($row['E']) ? trim((string) $row['E']) ?: null : null,
                    'rft' => ! empty($row['F']),
                    'reinforced' => ! empty($row['G']),
                    'marking' => trim($row['H'] ?? '') ?: null,
                    'made_in' => trim($row['I'] ?? '') ?: null,
                    'dot' => isset($row['J']) ? trim((string) $row['J']) ?: null : null,
                    'depot' => self::normalizeDepot($row['K'] ?? ''),
                    'zone' => trim($row['L'] ?? '') ?: null,
                    'quantity' => $qty,
                    'purchase_price' => is_numeric($row['N'] ?? null) ? round((float) $row['N'], 2) : null,
                    'selling_price' => is_numeric($row['P'] ?? null) ? round((float) $row['P'], 2) : null,
                    'special_price' => is_numeric($row['Q'] ?? null) ? round((float) $row['Q'], 2) : null,
                    'user_id' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                $count++;
            }
            Stock::insert($records);
        }

        $this->info("{$count} articles imported successfully.");

        return self::SUCCESS;
    }

    private static function normalizeDepot(string $value): ?string
    {
        $v = trim($value);
        if ($v === '') return null;

        $v = preg_replace('/\s+/', '', $v);
        return ucfirst(strtolower($v));
    }
}

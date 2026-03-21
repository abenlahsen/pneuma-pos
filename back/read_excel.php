<?php
$zip = new ZipArchive;
if ($zip->open('/var/www/html/../Vente Pneu 2026.xlsx') === TRUE) {
    $sharedStringsXml = $zip->getFromName('xl/sharedStrings.xml');
    $strings = [];
    if ($sharedStringsXml) {
        $xml = simplexml_load_string($sharedStringsXml);
        foreach ($xml->si as $si) {
            $strings[] = (string)$si->t;
        }
    }
    
    $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
    if ($sheetXml) {
        $xml = simplexml_load_string($sheetXml);
        $rows = 0;
        foreach ($xml->sheetData->row as $row) {
            $rowData = [];
            foreach ($row->c as $c) {
                $val = (string)$c->v;
                if ((string)$c['t'] == 's') {
                    $val = $strings[(int)$val] ?? $val;
                }
                $rowData[] = $val;
            }
            echo implode(" | ", $rowData) . "\n";
            $rows++;
            if ($rows >= 5) break; 
        }
    }
    $zip->close();
} else {
    echo "Failed to open Excel file.\n";
}

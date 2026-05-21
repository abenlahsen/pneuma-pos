<?php

namespace Database\Seeders;

use App\Models\City;
use Illuminate\Database\Seeder;

class CitiesSeeder extends Seeder
{
    public function run(): void
    {
        $cities = [
            'Agadir',
            'Aïn Harrouda',
            'Al Hoceïma',
            'Asilah',
            'Azemmour',
            'Azilal',
            'Beni Mellal',
            'Benguerir',
            'Berrechid',
            'Bouskoura',
            'Boujdour',
            'Boulemane',
            'Casablanca',
            'Chefchaouen',
            'Dakhla',
            'Dar Bouazza',
            'El Jadida',
            'El Kelaa des Sraghna',
            'Errachidia',
            'Essaouira',
            'Fès',
            'Figuig',
            'Guelmim',
            'Guercif',
            'Ifrane',
            'Inezgane',
            'Kénitra',
            'Khémisset',
            'Khénifra',
            'Khouribga',
            'Ksar el-Kébir',
            'Laâyoune',
            'Larache',
            'Marrakech',
            'Martil',
            'Meknès',
            'Midelt',
            'Mohammedia',
            'Nador',
            'Ouarzazate',
            'Oued Zem',
            'Oujda',
            'Rabat',
            'Safi',
            'Salé',
            'Settat',
            'Sidi Bennour',
            'Sidi Ifni',
            'Sidi Kacem',
            'Sidi Slimane',
            'Smara',
            'Tan-Tan',
            'Tanger',
            'Taounate',
            'Taourirt',
            'Taroudannt',
            'Taza',
            'Temara',
            'Tétouan',
            'Tiflet',
            'Tinghir',
            'Tiznit',
            'Zagora',
        ];

        foreach ($cities as $name) {
            City::firstOrCreate(['name' => $name]);
        }
    }
}

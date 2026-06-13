<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private function cities(): array
    {
        return [
            'Afourar', 'Aghbala', 'Aghbalou', 'Agdz', 'Agouraï', 'Aguelmous', 'Ahfir',
            'Aïn Leuh', 'Aïn Beni Mathar', 'Aïn Cheggag', 'Aïn Dorij', 'Aïn El-Aouda',
            'Aïn Erreggada', 'Aïn Jemaa', 'Aïn Karma', 'Aïn Taoujdate',
            'Aït Iaâza', 'Aït Baha', 'Aït Boubidmane', 'Aït Daoud', 'Aït Ishaq',
            'Aït Melloul', 'Aït Ourir', 'Akka', 'Aklim', 'Aknoul', 'Ajdir', 'Al Aroui',
            'Alnif', 'Amalou Ighriben', 'Amizmiz', 'Aoufous', 'Aoulouz', 'Aourir',
            'Arbaoua', 'Arfoud', 'Assa', 'Assahrij', 'Azrou',
            'Bab Berred', 'Bab Taza', 'Bejaâd', 'Ben Ahmed', 'Ben Slimane',
            'Ben Taïeb', 'Ben Yakhlef', 'Berkane', 'Bhalil', 'Biougra',
            'Bni Ansar', 'Bni Bouayach', 'Bni Chiker', 'Bni Drar', 'Bni Hadifa', 'Bni Tadjite',
            'Bouanane', 'Bouarfa', 'Boudnib', 'Bouguedra', 'Bouhdila', 'Bouizakarne',
            'Boujniba', 'Boulanouare', 'Boumalne-Dadès', 'Boumia', 'Bouznika',
            'Bouzthate', 'Bradia', 'Brikcha', 'Bzou',
            'Chichaoua',
            'Dar Bni Karrich', 'Dar Chaoui', 'Dar El Kebdani', 'Dar Gueddari', 'Dar Ould Zidouh',
            'Dcheira El Jihadia', 'Debdou', 'Demnate', 'Deroua', 'Drargua', 'Driouch',
            'Echemmaia', 'El Aïoun Sidi Mellouk', 'El Borouj', 'El Gara', 'El Hajeb',
            'El Hanchane', 'El Kbab', 'El Ksiba', 'El Mansouria',
            'El Marsa', 'El Menzel', 'El Ouatia', 'Erfoud', 'Er-Rich',
            'Fam El Hisn', 'Farkhana', 'Fnideq', 'Foum Jemaâ', 'Foum Zguid', 'Fkih Ben Salah',
            'Ghafsaï', 'Ghmate', 'Goulmima', 'Gourrama', 'Gueznaïa', 'Guigou', 'Guisser',
            'Had Bouhssoussen', 'Had Kourt', 'Had Oued Ifrane', 'Haj Kaddour', 'Hattane',
            'Ifrane Atlas Saghir', 'Ighoud', 'Ihddaden', 'Imintanoute',
            'Imouzzer Kandar', 'Imouzzer Marmoucha', 'Imzouren', 'Irherm', 'Issaguen', 'Itzer',
            'Jaâdar', 'Jamâat Shaim', 'Jebha', 'Jerada', 'Jorf', 'Jorf El Melha',
            "Kalaat M'Gouna", 'Karia', 'Karia Ba Mohamed', 'Kariat Arekmane', 'Kasba Tadla',
            'Kassita', 'Kattara', 'Kehf Nsour', 'Kerouna', 'Kerrouchen', 'Khémis Sahel', 'Khénichet',
            'Laâounate', 'Laakarta', 'Laâttaouia', 'Lagouira', 'Lakhsas', 'Lahraouyine',
            'Lalla Mimouna', 'Lalla Takarkoust', 'Lakouablia', "L'Bir Jdid",
            'Loualidia', 'Loulad', 'Lqliâa',
            'Maâziz', 'Madagh', 'Massa', 'Matmata', "M'diq", 'Médiouna',
            'Mechra Bel Ksiri', 'Mehdia', "M'haya", 'Midar', 'Missour', 'Moqrisset',
            'Moulay Abdallah', 'Moulay Ali Cherif', 'Moulay Bouazza', 'Moulay Bousselham',
            'Moulay Brahim', 'Moulay Driss Zerhoun', "M'rirt",
            'Naïma', 'Nouaceur',
            'Oualidia', 'Ouaouizeght', 'Oued Amlil', 'Oued Heimer', 'Oued Laou',
            'Ouezzane', 'Ouislane',
            'Oulad Abbou', 'Oulad Amrane', 'Oulad Ayad', 'Oulad Berhil', 'Oulad Frej',
            'Oulad Ghadbane', "Oulad H'Riz Sahel", 'Oulad Mrah', 'Oulad Saïd',
            'Oulad Teïma', 'Oulad Yaïch', 'Oulad Zbaïr',
            "Ouled M'barek", 'Ouled Tayeb', 'Oulmès', 'Oum El Guerdane', 'Ounagha', 'Outat El Haj',
            'Ras El Aïn', 'Ras El Ma', 'Ribate El Kheir', 'Rommani',
            'Sabaâ Aïyoun', 'Saïdia',
            'Sebt El Guerdane', 'Sebt El Maârif', 'Sebt Gzoula', 'Sebt Jahjouh',
            'Séfrou', 'Selouane',
            "Sid L'Mokhtar", 'Sid Zouin', 'Sidi Abdallah Ghiat', 'Sidi Addi', 'Sidi Ahmed',
            'Sidi Ali Ben Hamdouche', 'Sidi Allal El Bahraoui', 'Sidi Allal Tazi',
            'Sidi Bou Othmane', 'Sidi Boubker', 'Sidi Bouknadel', 'Sidi Bouzid',
            'Sidi Hajjaj Oulad Mrah', 'Sidi Jaber', 'Sidi Lyamani',
            'Sidi Rahhal', 'Sidi Rahhal Chataï', 'Sidi Slimane Echcharaa',
            'Sidi Smaïl', 'Sidi Taïbi', 'Sidi Yahya El Gharb',
            'Skhirat', 'Skhour Rehamna', 'Skoura', 'Smimou', 'Soualem',
            'Souk El Arbaa du Gharb', 'Souk Sebt Oulad Nemma',
            'Tabounte', 'Tafersit', 'Tafetachte', 'Tafraout', 'Taghjijt', 'Tahannaout',
            'Tahla', 'Taïnaste', 'Talmest', 'Taliouine', 'Talsint', 'Tamanar',
            'Tamassint', 'Tamegroute', 'Tamellalt', 'Tameslouht',
            'Tarfaya', 'Targuist', 'Tata', 'Taznakht', 'Temsia', 'Tendrara',
            'Thar Es-Souk', 'Tiddas', 'Tighassaline', 'Tighza', 'Timahdite',
            'Tinejdad', 'Tissa', 'Tit Mellil', "Tizi N'Test", 'Tizi Ouasli', 'Tiztoutine',
            'Touima', 'Touissit', 'Toulal', 'Tounfite',
            'Youssoufia',
            'Zag', 'Zaïda', 'Zaïo', 'Zaouïat Bougrine', 'Zaouïat Cheikh',
            'Zeghanghane', 'Zemamra', 'Zirara', 'Zoumi', 'Zrarda',
        ];
    }

    public function up(): void
    {
        DB::table('cities')->insertOrIgnore(
            array_map(fn($name) => ['name' => $name], $this->cities())
        );
    }

    public function down(): void
    {
        DB::table('cities')->whereIn('name', $this->cities())->delete();
    }
};

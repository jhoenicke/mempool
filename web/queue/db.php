<?php
/* 
    Bitcoin Mempool Visualization
    Copyright (C) 2017  Jochen Hoenicke

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

$dbtype	= "sqlite";
$dbdatabase = "/home/mempool/mempool/mempool.s3db";
$dbdsn = "$dbtype:$dbdatabase";
$dbuser = "";
$dbpass = "";
$dboptions = array();

try {
    $db = new PDO($dbdsn, $dbuser, $dbpass, $dboptions);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    if (!isset($_GET["s"]) || !isset($_GET["e"])) {
        exit;
    }
    $start = intval($_GET["s"]);
    $end = intval($_GET["e"]);
    $increment = 1;
    if (isset($_GET["i"])) {
        $increment = intval($_GET["i"]);
    }
    if ($increment <= 0) {
        $increment = 1;
    }
    $query = $db->prepare("SELECT * FROM mempool WHERE time >= :start AND time < :end ORDER BY time");

    $query->execute(array(':start' => $start, ':end' => $end));
    header("Content-Type: application/json; charset=UTF-8");
    echo 'call([';
    $comma="";
    $ctr = $increment;
    while ($row = $query->fetch(PDO::FETCH_NUM)) {
    	if ($ctr > 1) {
	    $ctr--;
	    continue;
	}
	for ($i = 0; $i < 53; $i++) {
	    if (!isset($row[1+$i])) { $row[1+$i] = 0; };
	}
    	echo $comma.'['.$row[0].',['.
	     $row[1].','.$row[2].','.$row[3].','.$row[4].','.$row[5].','.
	     $row[6].','.$row[7].','.$row[8].','.$row[9].','.$row[10].','.
	     $row[11].','.$row[12].','.$row[13].','.$row[14].','.$row[15].','.
	     $row[16].','.$row[17].','.$row[18].','.$row[19].','.$row[20].','.
	     $row[21].','.$row[22].','.$row[23].','.$row[24].','.$row[25].','.
	     $row[26].'],['.
	     $row[27].','.$row[28].','.$row[29].','.$row[30].','.
	     $row[31].','.$row[32].','.$row[33].','.$row[34].','.$row[35].','.
	     $row[36].','.$row[37].','.$row[38].','.$row[39].','.$row[40].','.
	     $row[41].','.$row[42].','.$row[43].','.$row[44].','.$row[45].','.
	     $row[46].','.$row[47].','.$row[48].','.$row[49].','.$row[50].','.
	     $row[51].','.$row[52].'],'.$row[53].']';
	$comma = ",\n";
	$ctr = $increment;
    }
    echo "]);\n";
    exit;
} catch (PDOException $ex) {
    header('HTTP/1.1 500 Internal Server Error');
    echo $ex->getMessage().$ex;
    exit;
}
?>

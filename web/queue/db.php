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

$dbtype = "mysql";
$dbdatabase = "dbname=btc_mempool;host=localhost";
$dbdsn = "$dbtype:$dbdatabase";
$dbuser = "www";
$dbpass = "<redacted>";
$dboptions = array();

$feelevels = 46;

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
    /*
     * Resolution ladder (minutes between samples).  Each step divides the
     * next, so the persistent generated column `res` (the coarsest level a
     * row belongs to) makes "every Nth minute" a sargable index lookup:
     * a row qualifies for level L iff res >= L.  We pick the finest ladder
     * step <= the requested increment and select that level and coarser via
     * the (res, time) index, instead of scanning the whole interval and
     * applying a non-indexable MOD.  See altertable-res.sql.
     */
    $ladder = array(1, 2, 10, 60, 360, 1440);
    $level = 0;
    for ($k = 0; $k < count($ladder); $k++) {
        if ($ladder[$k] <= $increment) {
            $level = $k;
        }
    }
    $levels = implode(",", range($level, count($ladder) - 1));  // integers, safe to inline
    $query = $db->prepare("SELECT * FROM mempool WHERE res IN ($levels) AND time >= :start AND time < :end ORDER BY time");

    $query->execute(array(':start' => $start, ':end' => $end));
    header("Content-Type: application/javascript; charset=UTF-8");
    echo 'call([';
    $comma="";
    while ($row = $query->fetch(PDO::FETCH_NUM)) {
        for ($i = 0; $i < 3*$feelevels+1; $i++) {
            if (!isset($row[$i])) {
                $row[$i] = 0;
            }
        }
        echo $comma.'['.$row[0].',['.
             join(',', array_slice($row, 1, $feelevels)).'],['.
             join(',', array_slice($row, 1 + $feelevels, $feelevels)).'],['.
             join(',', array_slice($row, 1 + 2*$feelevels, $feelevels)).']]';
        $comma = ",\n";
    }
    echo "]);\n";
    exit;
} catch (PDOException $ex) {
    header('HTTP/1.1 500 Internal Server Error');
    echo $ex->getMessage().$ex;
    exit;
}
?>

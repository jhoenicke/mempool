#!/bin/bash
for TYPE in all 2h 8h 24h 2d 4d 1w 2w 30d 3m; do
perl -pe '
  $SEC2h=7200;$SEC8h=28800;$SEC24h=86400;$SEC2d=172800;$SEC4d=345600;
  $SEC1w=604800;$SEC2w=1209600;$SEC30d=2592000;$SEC3m=7862400;
  s/__SECONDS__/$SEC'"$TYPE"'/g;
  s/__TYPE__/'$TYPE'/;
  '  template.html > $TYPE.html
done

exit 0

#!/bin/sh

grf="Gruntfile.js"
cpath=`pwd`
filename=$(basename -- "$cpath")
extension="${filename##*.}"
a="$extension"
echo "cpath = $cpath, extension = $extension"
dpath="/c/iobroker/Test2/node_modules/iobroker.$a"
if [ -d "$dpath" ]; then
   echo "dpath = $dpath"
else
   dpath="/c/iobroker/Test2/node_modules/ioBroker.$a"
   if [ -d "$dpath" ]; then
      echo "dpath = $dpath"
   else
      echo "$dpath not found!"
      exit 1
   fi
fi

inspect="--inspect"
if [ "$1" == "d" ] || [ $# -gt 1 ]; then
        echo "Debug mode set"
        shift
        inspect="--inspect-brk"
fi

#shift
#sudo chmod aug+rw $cpath/*
echo sudo -u iobroker rsync -r -v -u $cpath/*.js *.json *.md $dpath/
rsync -r -v -u --delete $cpath/*.js $cpath/*.json $cpath/*.md $dpath/

for var in "$@"; do
    echo "rsync -r -v -u - $cpath/$var $dpath"
#    rsync -r -v -u - $cpath/$var $dpath
#    sudo cp $cpath/$var $dpath
done

for var in lib admin;  do
    echo rsync -r -v -u $cpath/$var $dpath/
    rsync -r -v -u --delete $cpath/$var $dpath/
done

echo "all done!"
ls -CFA $dpath
cd /c/iobroker/Test2
/c/iobroker/Test2/iob.bat upload $a
#iobroker upload $a
#echo sudo chown -hR iobroker  $dpath
#sudo chown -hR iobroker  $dpath
#sudo chgrp -hR iobroker  $dpath

echo sudo -u iobroker node --inspect=localhost:9229  $dpath/$a.js --force --logs --nolazy
node $inspect=localhost:9229  $dpath/$a.js --force --logs --nolazy

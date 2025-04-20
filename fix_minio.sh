#!/bin/bash
# Primero, crear una copia de respaldo
cp /home/runner/workspace/src/utils/cloud/adapters/minio.js /home/runner/workspace/src/utils/cloud/adapters/minio.js.bak

# Corregir ambas líneas
sed -i '231s/<\/Name>/<\/n>/g' /home/runner/workspace/src/utils/cloud/adapters/minio.js
sed -i '1158s/<\/Name>/<\/n>/g' /home/runner/workspace/src/utils/cloud/adapters/minio.js

# Verificar los cambios
grep -n "bucketMatches" -A 1 /home/runner/workspace/src/utils/cloud/adapters/minio.js | grep -E "<n>|<\/n>|Name"

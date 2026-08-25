# Shortcode Gen — deployment-suunnitelma

## 1. Ympäristöt

Shortcode Gen käyttää kolmea selkeästi erilaista ympäristöä:

| Ympäristö | Sovellus | Tietokanta | Reverse proxy |
|---|---|---|---|
| Local development | Node / Next.js suoraan | SQLite | Ei tarvita |
| Staging | Docker | PostgreSQL Docker Compose -palveluna | Nginx |
| Production | Docker | PostgreSQL toisesta projektista | Traefik |

Ympäristöjen tarkoitus on pitää paikallinen kehitys mahdollisimman kevyenä, staging tuotantoa muistuttavana ja production infrastruktuuriltaan erillisenä.

## 2. Local development

Paikallinen normaali kehitys ei käytä Dockeria.

```text
Developer machine
       |
       v
  Next.js app
       |
       v
     SQLite
```

### Tietokanta

- Prisma + SQLite
- paikallinen tietokanta esimerkiksi `./dev.db`
- Prisma migrationit versionhallinnassa
- ei tarvitse käynnistää PostgreSQL:ää kehitystä varten

Esimerkkikonfiguraatio:

```env
DATABASE_URL="file:./dev.db"
PUBLIC_URL="http://localhost:3000"
SCREENSHOT_DIR="./data/screenshots"
```

### Käynnistys

```bash
npm install
npx prisma migrate dev
npm run dev
```

Worker voidaan ajaa erillisenä Node-prosessina tarvittaessa.

Local developmentin tavoitteena ei ole jäljitellä Docker-ympäristöä täydellisesti, vaan mahdollistaa nopea koodaus, testaus ja UI-kehitys.

## 3. Staging

Staging ajetaan Dockerilla. PostgreSQL kuuluu staging-kokonaisuuteen ja ajetaan Docker Composella.

```text
                         Internet / LAN
                              |
                              v
                           Nginx
                              |
                 +------------+------------+
                 |                         |
                 v                         v
          shortcode-web              tarvittaessa
                 |                    worker
                 +------------+------------+
                              |
                              v
                         PostgreSQL
```

### Staging-palvelut

Docker Compose sisältää vähintään:

```text
app
worker
postgres
```

Nginx ei välttämättä kuulu samaan Compose-projektiin. Se toimii reverse proxyna Docker-palveluiden edessä ja päättää staging-hostin liikenteen sovellukselle.

### Staging-tietokanta

PostgreSQL:n data säilytetään persistentissä Docker-volumessa.

Sovellus saa yhteyden ympäristömuuttujasta:

```env
DATABASE_URL=postgresql://...
```

Migraatiot ajetaan stagingissa ennen sovelluksen käyttöönottoa:

```bash
npx prisma migrate deploy
```

### Staging-image

Staging käyttää samaa production-kelpoista Docker-imagea kuin production aina kun mahdollista. Ero on ensisijaisesti infrastruktuurissa ja konfiguraatiossa.

## 4. Production

Productionissa sovellus ajetaan Dockerilla. PostgreSQL ei kuulu tämän projektin Compose-kokoonpanoon, vaan se tulee toisesta projektista, joka ylläpitää PostgreSQL-containeria.

```text
                         Internet
                            |
                            v
                         Traefik
                            |
                   +--------+--------+
                   |                 |
                   v                 v
            shortcode-web      shortcode-worker
                   |                 |
                   +--------+--------+
                            |
                            v
                PostgreSQL container
                  (another project)
```

### Production PostgreSQL

Shortcode Gen:

- ei luo PostgreSQL-containeria
- ei hallitse PostgreSQL-containerin lifecyclea
- ei tarvitse omaa PostgreSQL Docker Compose -palvelua
- saa yhteyden olemassa olevaan tietokantaan `DATABASE_URL`:n kautta

PostgreSQL:n backupit, päivitykset ja muu ylläpito kuuluvat PostgreSQL:ää ylläpitävälle projektille.

### Production reverse proxy

Traefik vastaa:

- host/path routingista
- TLS-terminoinnista
- HTTPS-liikenteestä
- Docker-palveluiden löytämisestä ja reitityksestä

Shortcode Gen -containerien ei tarvitse itse hoitaa julkisen HTTPS:n sertifikaatteja.

## 5. Production containers

Web ja worker voivat käyttää samaa imagea:

```text
shortcode-gen:<version>
```

Esimerkiksi:

```text
shortcode-web
  command: npm run start

shortcode-worker
  command: npm run worker
```

Containerien tulee olla mahdollisimman stateless lukuun ottamatta screenshot-tiedostoja.

## 6. Persistent screenshot storage

Screenshotit eivät saa kadota containerin uudelleenkäynnistyksessä.

Productionissa screenshot-hakemisto mountataan persistenttiin volumeen:

```text
/data/screenshots
```

Sama volume on tarvittaessa mountattava sekä web- että worker-containeriin, jos web tarjoilee screenshotit suoraan tiedostojärjestelmästä ja worker kirjoittaa niitä.

Stagingissa voidaan käyttää vastaavaa Docker-volumea.

## 7. Configuration and secrets

Ympäristökohtaiset asetukset annetaan ympäristömuuttujilla. `.env`-tiedostoja ei commitoida repositoryyn.

Vähintään:

```env
DATABASE_URL=
SESSION_SECRET=
PUBLIC_URL=
SCREENSHOT_DIR=/data/screenshots
WORKER_INTERVAL_SECONDS=60
METADATA_REFRESH_HOURS=24
FETCH_TIMEOUT_MS=15000
FETCH_MAX_BYTES=5242880
```

Local development voi käyttää `.env.local`-tiedostoa. Staging- ja production-palvelimilla salaisuudet annetaan palvelimen konfiguraation kautta.

## 8. Database migration strategy

Migrationit ovat versionhallittuja ja kulkevat ympäristöjen läpi järjestyksessä:

```text
local
  |
  v
staging
  |
  v
production
```

Local:

```bash
npx prisma migrate dev
```

Staging/production:

```bash
npx prisma migrate deploy
```

`prisma db push` ei ole deployment-menetelmä.

Production-migraatio ajetaan ennen uuden sovellusversion liikenteen avaamista, jos uusi versio vaatii kyseisen scheman.

## 9. Deployment flow

Tavoiteltu perusprosessi:

```text
code
 |
 v
GitHub
 |
 v
build/test
 |
 v
Docker image
 |
 +------> staging
 |          |
 |          +--> migrations
 |          +--> smoke tests
 |
 +------> production
            |
            +--> migration
            +--> web + worker update
            +--> health check
```

CI/CD:n yksityiskohtainen toteutus voidaan päättää myöhemmin. Deployment-suunnitelman ei tarvitse sitoa projektia tiettyyn registryyn tai CI-palveluun tässä vaiheessa.

## 10. Health checks

Sovelluksella tulee olla kevyt health endpoint, esimerkiksi:

```text
GET /api/health
```

Health checkin tulee varmistaa ainakin, että web-sovellus on käynnissä. Tarvittaessa voidaan erottaa readiness-check, joka tarkistaa myös tietokantayhteyden.

Docker-, staging- ja Traefik-konfiguraatioiden tulee pystyä käyttämään health/readiness-tietoa liikenteen ohjaamiseen.

## 11. Staging smoke tests

Deploymentin jälkeen stagingissa tarkistetaan vähintään:

- health endpoint
- admin login
- linkin luonti
- metadata-jobin käynnistyminen
- screenshotin syntyminen
- `/s/<code>`-sivu
- case-insensitive short code lookup
- countdown
- manuaalinen siirtyminen kohdesivulle

## 12. Production deployment safety

Production-deploymentissa:

1. rakennetaan ja testataan image
2. varmistetaan stagingin onnistuminen
3. ajetaan tarvittavat Prisma-migraatiot
4. käynnistetään uusi web/worker-versio
5. varmistetaan health endpoint
6. varmistetaan Traefikin kautta saavutettavuus
7. vasta sen jälkeen vanha versio poistetaan

Jos mahdollista, web-palvelun päivitys tehdään niin, että lyhyt katkos vältetään.

## 13. Rollback

Docker-imageiden tulee olla versionoituja, jotta edellinen toimiva image voidaan ottaa nopeasti takaisin käyttöön.

```text
current image
     |
     v
failure
     |
     v
previous known-good image
```

Database rollbackia ei oleteta automaattiseksi. Migrationit suunnitellaan ensisijaisesti backward-compatible tavalla, jotta sovellusversion rollback ei riko tietokantaa.

## 14. Backups

Shortcode Genin PostgreSQL production-backupit eivät kuulu tähän repositoryyn, koska production PostgreSQL on toisen projektin hallinnassa.

Tässä projektissa dokumentoidaan kuitenkin riippuvuus:

- PostgreSQL-backupit ovat productionin edellytys
- screenshot-tiedostojen persistentti säilytys on erillinen tarve
- palautusprosessissa tietokanta ja screenshot-storage pitää pystyä palauttamaan yhteensopivaan tilaan

Stagingin tietokanta voidaan tarvittaessa luoda uudelleen Compose-volumesta.

## 15. Security

Deploymentin tulee varmistaa vähintään:

- PostgreSQL ei ole julkisesti internetiin avoinna
- staging PostgreSQL on saavutettavissa vain staging-sovelluksille
- production PostgreSQL on saavutettavissa vain tarvittavilta production-containereilta
- Traefik/Nginx altistaa julkisesti vain tarvittavat HTTP(S)-reitit
- `.env` ja secrets eivät kuulu Git-repoon
- screenshot-volume ei altista raakaa filesystem-polkuja internetiin ilman sovelluksen kontrollia
- containerit ajetaan mahdollisimman vähäisillä oikeuksilla

## 16. Environment summary

### Local

```text
Next.js: local process
Worker: local process
DB: SQLite file
Proxy: none
Docker: no
```

### Staging

```text
Next.js: Docker
Worker: Docker
DB: PostgreSQL / Docker Compose
Proxy: Nginx
Docker: yes
```

### Production

```text
Next.js: Docker
Worker: Docker
DB: PostgreSQL / another project's Docker container
Proxy: Traefik
Docker: yes
```

## 17. Deployment principle

Local development optimizes for speed and simplicity. Staging optimizes for reproducibility and production-like behavior. Production keeps the application deployment separate from the PostgreSQL infrastructure that already exists elsewhere.

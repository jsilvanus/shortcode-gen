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

Web ja worker käyttävät samaa imagea, mutta ovat **eri Docker-containereita ja eri prosesseja**:

```text
shortcode-gen:<version>
        |
        +--------------------------+
        |                          |
        v                          v
  shortcode-web              shortcode-worker
  command:                   command:
    npm run start              npm run worker
```

Yksi image voidaan siis julkaista kerran ja käynnistää kahdella eri Compose-palvelulla.

Containerien tulee olla mahdollisimman stateless lukuun ottamatta screenshot-tiedostoja.

### 5.1 Graceful shutdown

Web- ja worker-containerien shutdown käsitellään eri tavalla niiden tehtävien perusteella.

#### Web

Web-containerissa normaali Next.js-prosessi vastaanottaa Dockerin `SIGTERM`-signaalin ja lopettaa hallitusti. Reverse proxyn tulee poistaa vanha container liikenteen piiristä ennen sen pysäyttämistä, jotta uusia pyyntöjä ei ohjata sulkeutuvaan instanssiin.

Web-containerille varataan shutdowniin riittävä grace period, esimerkiksi:

```yaml
web:
  stop_grace_period: 30s
```

Erillistä process manageria ei käytetä containerin sisällä.

#### Worker

Workerin tulee käsitellä `SIGTERM` ja `SIGINT` itse.

Shutdownin aikana worker:

1. lopettaa uusien jobien aloittamisen
2. antaa parhaillaan käynnissä olevan jobin valmistua
3. sulkee tietokantayhteydet ja muut resurssit
4. poistuu normaalisti

Workerille varataan webiä pidempi grace period, esimerkiksi:

```yaml
worker:
  stop_grace_period: 60s
```

Jos worker ei poistu grace periodin aikana, Docker voi lopulta pakottaa prosessin alas. Grace periodin tulee siksi olla riittävän pitkä normaalin screenshot- ja metadata-jobin valmistumiseen.

Workerin shutdown-logiikan perusperiaate on:

```text
SIGTERM
   |
   v
shuttingDown = true
   |
   v
älä aloita uutta jobia
   |
   v
viimeistele nykyinen jobi
   |
   v
sulje resurssit
   |
   v
exit
```

Worker-jobien tulee lisäksi olla mahdollisimman turvallisia toistaa. Jos container kaatuu tai jobi keskeytyy ennen valmistumista, seuraavan worker-kierroksen pitää voida yrittää työtä uudelleen ilman rikkinäistä tilaa. Tavoitteena on käytännössä vähintään **at-least-once** -tyyppinen työnsuoritus.

Erillistä process manageria, kuten `supervisord`:ia, ei käytetä containerin sisällä. Yksi pääprosessi per container pidetään deployment-mallin perustana.

## 6. Persistent screenshot storage

Screenshotit eivät saa kadota containerin uudelleenkäynnistyksessä.

Productionissa screenshot-hakemisto mountataan persistenttiin volumeen:

```text
/data/screenshots
```

Sama volume on tarvittaessa mountattava sekä web- että worker-containeriin, jos web tarjoilee screenshotit suoraan tiedostojärjestelmästä ja worker kirjoittaa niitä.

Stagingissa voidaan käyttää vastaavaa Docker-volumea.

Screenshot-jobien tulee kirjoittaa lopullinen tiedosto siten, ettei keskeneräinen tiedosto näyttäydy valmiina screenshotina. Tarvittaessa tiedosto voidaan kirjoittaa väliaikaisella nimellä ja nimetä valmiiksi vasta onnistuneen kirjoituksen jälkeen.

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

### 9.1 Production container update

Webin ja workerin päivityksessä käytetään samaa versionoitua imagea. Molemmat containerit vaihdetaan hallitusti, mutta niiden graceful shutdown -käytännöt säilyvät erillisinä:

```text
new image
   |
   +--> new web container
   |       |
   |       +--> health check
   |
   +--> new worker container
           |
           +--> ready

old web      -- SIGTERM --> drain --> exit
old worker   -- SIGTERM --> finish job --> exit
```

Webin liikenne ohjataan uudelle healthy-instanssille ennen vanhan web-containerin poistamista aina kun deployment-ympäristö ja Traefik-konfiguraatio mahdollistavat sen. Workerille ei tarvita liikenteen drainia: se lopettaa uusien jobien aloittamisen ja viimeistelee nykyisen työn ennen poistumistaan.

## 10. Health checks

Sovelluksella tulee olla kevyt health endpoint, esimerkiksi:

```text
GET /api/health
```

Health checkin tulee varmistaa ainakin, että web-sovellus on käynnissä. Tarvittaessa voidaan erottaa readiness-check, joka tarkistaa myös tietokantayhteyden.

Docker-, staging- ja Traefik-konfiguraatioiden tulee pystyä käyttämään health/readiness-tietoa liikenteen ohjaamiseen.

Workerille voidaan myöhemmin lisätä erillinen health/readiness-mekanismi, jos sen toimintaa halutaan seurata aktiivisesti. Workerin normaali graceful shutdown ei kuitenkaan edellytä erillistä HTTP-palvelinta.

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
7. annetaan vanhoille web- ja worker-containereille graceful shutdown -aika
8. vasta sen jälkeen vanhat versiot poistetaan

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

Workerin keskeneräisen jobin osalta rollback perustuu siihen, että jobit ovat turvallisesti uudelleenajettavia. Uuden worker-version graceful shutdown antaa nykyisen jobin valmistua ennen rollbackia aina kun mahdollista.

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
Next.js: Docker container
Worker: separate Docker container
DB: PostgreSQL / another project's Docker container
Proxy: Traefik
Docker: yes
```

## 17. Deployment principle

Local development optimizes for speed and simplicity. Staging optimizes for reproducibility and production-like behavior. Production keeps the application deployment separate from the PostgreSQL infrastructure that already exists elsewhere.

The web and worker are separate processes and separate containers, even though they use the same application image. The web container drains HTTP traffic during shutdown; the worker stops accepting new jobs, finishes the current job, closes resources, and exits. Jobs should be safely retryable so that an unexpected interruption does not leave the system in an unrecoverable state.

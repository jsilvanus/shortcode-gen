# Shortcode Gen — tekninen suunnitelma

## 1. Tavoite

Shortcode Gen on pieni lyhytlinkkipalvelu. Admin kirjautuu palveluun, luo lyhytkoodin pitkälle URL-osoitteelle ja palvelu näyttää lyhytlinkin kautta lyhyen välisivun ennen kohdesivulle siirtymistä.

Keskeinen tavoite on myös hyvä sosiaalisen median esikatselu. Lyhytlinkki palauttaa palvelimelta HTML-sivun, jossa ovat Open Graph -tiedot, eikä pelkkää HTTP 302 -uudelleenohjausta.

## 2. Teknologiat

- TypeScript
- Next.js / App Router
- React
- PostgreSQL
- Prisma
- Argon2id salasanojen hashaukseen
- Session-pohjainen autentikointi HttpOnly-cookieilla
- Node `fetch` metadatahakuun
- HTML-parser metadataa varten
- Playwright screenshotteihin ja JavaScript-renderöityjen sivujen fallback-käsittelyyn
- Docker
- Docker Compose kehitykseen
- `.env` konfiguraatioon

Redisia ei tarvita. Taustatyöt toteutetaan aluksi PostgreSQL-pohjaisella job-taululla.

## 3. Arkkitehtuuri

Yksi repository ja yksi sovelluskokonaisuus, jossa on kaksi prosessiroolia:

```text
                    Internet
                       |
                       v
                reverse proxy
                       |
              +--------+--------+
              |                 |
              v                 v
        shortcode-web     shortcode-worker
              |                 |
              +--------+--------+
                       |
                       v
                  PostgreSQL
```

Web ja worker voivat käyttää samaa Docker-imagea eri käynnistyskomennolla.

Worker vastaa metadatahauista, screenshot-kuvista ja päivittäisistä tarkistuksista. Julkinen redirect-sivu ei tee hidasta kohdesivun hakua käyttäjän requestin aikana.

## 4. Repository-rakenne

```text
shortcode-gen/
├── app/
│   ├── admin/
│   │   ├── login/
│   │   └── dashboard/
│   ├── s/
│   │   └── [code]/
│   ├── api/
│   │   ├── auth/
│   │   └── links/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── admin/
│   ├── redirect/
│   └── ui/
├── lib/
│   ├── auth/
│   ├── db/
│   ├── links/
│   ├── metadata/
│   ├── security/
│   └── validation/
├── worker/
│   ├── index.ts
│   ├── metadata-job.ts
│   └── scheduler.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── scripts/
│   └── create-user.ts
├── tests/
│   ├── unit/
│   └── integration/
├── docker/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 5. URL-rakenne

Julkiset lyhytlinkit käyttävät alkuun `/s/<code>`-muotoa, jotta juurireitti ja tulevat reitit pysyvät vapaina.

```text
GET    /s/:code
GET    /admin/login
GET    /admin/dashboard
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/links
GET    /api/links
GET    /api/links/:id
PATCH  /api/links/:id
DELETE /api/links/:id
```

Esimerkki:

```text
https://short.example/s/a8K3x
```

## 6. Tietokanta

### users

```text
id
username
password_hash
created_at
updated_at
```

Käyttäjätasoja ei tarvita. Palvelussa on yksi admin-käyttäjätyyppi.

### short_links

```text
id
code
target_url

title
description
canonical_url
image_url
favicon_url

screenshot_path
screenshot_width
screenshot_height

metadata_source
content_hash

created_at
updated_at
last_checked_at
last_successful_fetch_at

click_count
last_clicked_at
active
```

`code` on `UNIQUE`.

### jobs

```text
id
type
short_link_id
status
attempts
run_after
started_at
finished_at
last_error
created_at
updated_at
```

Job-tyypit ovat aluksi `FETCH_METADATA` ja `REFRESH_METADATA`.

Statusarvot ovat `pending`, `running`, `completed` ja `failed`.

## 7. Lyhytkoodit

Lyhytkoodi generoidaan satunnaisesti 6–8 merkin mittaisena turvallisesta alfanumeerisesta alphabetista. Tietokannassa on unique constraint. Collisionin sattuessa generoidaan uusi koodi.

Järjestelmä ei käytä juoksevia ID-numeroita julkisina koodeina.

Custom code voidaan tukea myöhemmin ilman schema-muutosta.

## 8. Admin

Admin UI pidetään tarkoituksella yksinkertaisena.

### Login

- käyttäjänimi
- salasana
- login/logout
- session HttpOnly + Secure + SameSite=Lax -cookiella
- ei localStorage-tokenia
- ei JWT:tä MVP:ssä

Admin luodaan scriptillä:

```bash
npm run create-user
```

Salasanat tallennetaan Argon2id-hashina.

### Dashboard

Dashboard on taulukko, jossa näkyvät vähintään:

- screenshot/thumbnail
- kohdesivun otsikko
- short code
- päivityksen tila/aika

`+ Lisää` avaa lomakkeen/modalin uuden linkin luomiseen.

Riviltä voi myöhemmin muokata, deaktivoida, poistaa, kopioida lyhytlinkin tai avata sen.

## 9. Linkin luonti

Admin syöttää kohde-URL:n. Palvelin validoi URL:n, luo short coden ja tallentaa linkin. Metadatahaku käynnistetään jobina.

Luontiprosessi:

```text
validate URL
    |
    v
create short_link
    |
    v
create FETCH_METADATA job
    |
    v
return to admin
```

Admin näkee metadatahaun tilan ja lopullisen previewn.

## 10. Metadatahaku

Metadata haetaan ensin tavallisella HTTP requestilla. Parseri poimii ainakin:

- `<title>`
- meta description
- `og:title`
- `og:description`
- `og:image`
- canonical URL
- favicon

Jos sivu on JavaScript-renderöity tai metadataa ei saada riittävästi, worker käyttää Playwrightia.

Playwrightia ei käytetä oletuksena jokaiseen URL:iin.

## 11. Screenshotit

Playwright voi ottaa kohdesivusta screenshotin. MVP:ssä tallennetaan yksi desktop-kuva, jota käytetään responsive UI:ssa.

Esimerkkikoko:

```text
1280 x 720
```

Kuvat tallennetaan persistenttiin hakemistoon/volumeen, esimerkiksi:

```text
/data/screenshots/<code>.webp
```

Myöhemmin voidaan tehdä erillinen mobile screenshot, jos sille on todellinen tarve.

## 12. Redirect/interstitial-sivu

`GET /s/:code` palauttaa server-renderöidyn HTML-sivun.

Sivulla näytetään esimerkiksi:

> Olet siirtymässä eteenpäin
>
> [kohdesivun screenshot]
>
> [kohdesivun otsikko]
>
> example.com/sivu
>
> 5
>
> Sivulle siirrytään automaattisesti
>
> [Pysäytä siirtyminen]

Countdown:

```text
5 -> 4 -> 3 -> 2 -> 1 -> target URL
```

Jos käyttäjä pysäyttää siirtymisen, laskuri pysähtyy ja UI tarjoaa `Siirry sivulle` -painikkeen.

Sivu toimii HTML:n osalta myös ilman JavaScriptiä mahdollisimman järkevästi.

Palvelu ei tee tässä vaiheessa HTTP 301/302 -redirectiä, koska välisivu ja social preview ovat keskeinen osa toimintaa.

## 13. Social sharing

Server-renderöity redirect-sivu sisältää:

```text
og:title
og:description
og:image
og:url

twitter:card
 twitter:title
 twitter:description
 twitter:image
```

Social crawlerien ei tarvitse ajaa JavaScriptiä saadakseen preview-tiedot.

Pitkällä aikavälillä palvelu voi generoida oman yhtenäisen social preview -kuvan kohdesivun screenshotista, otsikosta ja URL:sta. Tämä on suositeltava fallback, jos kohdesivulla ei ole hyvää `og:image`-kuvaa.

## 14. Hakukoneet

Lyhytlinkkisivuja ei indeksoida:

```html
<meta name="robots" content="noindex,nofollow">
```

Jos kohdesivun canonical URL tunnetaan, se voidaan ilmoittaa canonical-linkkinä. Tarkoitus ei ole tehdä short-link-sivuista hakukoneiden indeksoitavaa duplicate contentia.

## 15. Päivittäinen metadata-refresh

Worker tarkistaa aktiiviset linkit vähintään kerran vuorokaudessa.

Ensisijaisesti tehdään tavallinen HTTP-haku ja verrataan metadataan perustuvaa `content_hash`-arvoa.

Jos sisältö ei ole muuttunut, uutta screenshotia ei tarvitse tehdä.

Jos sisältö on muuttunut, Playwright voi tehdä uuden screenshotin.

Refresh suoritetaan jobina, ei käyttäjän redirect-requestin aikana.

## 16. SSRF-suojaus

URL-fetcher on turvallisuuskriittinen osa palvelua, koska serveri tekee outbound requesteja adminin antamiin URL-osoitteisiin.

`lib/security/url-safety.ts` validoi ainakin:

- vain `http` ja `https`
- ei localhostia
- ei loopback-osoitteita
- ei RFC1918 private IPv4 -osoitteita
- ei link-local-osoitteita
- ei private/local IPv6 -osoitteita
- DNS resolution tarkistetaan
- redirectit tarkistetaan uudelleen
- timeoutit
- response size limit

Myös Playwright-ajon tulee käyttää vastaavia rajoja ja eristystä.

## 17. HTTP-fetchin rajat

Alustavat rajat:

```text
connect timeout: 5 s
overall timeout: 15 s
max response: 5 MB
max redirects: 5
```

Rajat pidetään konfiguroitavina ympäristömuuttujilla.

## 18. Worker

Worker hakee PostgreSQL:stä vapaita jobeja ja käsittelee ne.

```text
pending job
   |
   v
claim job
   |
   v
fetch / Playwright
   |
   v
update short_link
   |
   v
completed
```

Virheissä job voidaan retryttää rajatun määrän kertoja. Worker ei saa aiheuttaa samalle URL:lle loputonta retry-loopia.

## 19. Docker

Development käyttää Docker Composea, jossa on vähintään:

```text
postgres
app
worker
```

PostgreSQL on kehityksessä Compose-palveluna persistentillä volumella.

Productionissa sovellus containerisoidaan, mutta PostgreSQL voi olla erillisessä jo olemassa olevassa Docker-containerissa. Sovellus saa yhteyden `DATABASE_URL`-ympäristömuuttujasta.

Web ja worker voivat käyttää samaa Docker-imagea eri commandilla.

## 20. Ympäristömuuttujat

`.env.example` sisältää vähintään:

```env
DATABASE_URL=postgresql://shortcode:password@localhost:5432/shortcode
SESSION_SECRET=
PUBLIC_URL=https://short.example
SCREENSHOT_DIR=/data/screenshots
WORKER_INTERVAL_SECONDS=60
METADATA_REFRESH_HOURS=24
FETCH_TIMEOUT_MS=15000
FETCH_MAX_BYTES=5242880
```

`.env` ei kuulu git-repoon.

## 21. Prisma

Kehityksessä käytetään migraatioita:

```bash
npx prisma migrate dev
```

Tuotannossa:

```bash
npx prisma migrate deploy
```

Tuotannossa ei käytetä `prisma db push` -komentoa schema-muutoksiin.

## 22. Testaus

### Unit-testit

- short code generation
- URL validation
- private IP detection
- metadata parsing
- content hashing

### Integration-testit

- user creation
- login/logout
- unauthorized admin access
- create link
- fetch link
- persistence
- worker job lifecycle

### E2E-testit

Playwrightilla testataan ainakin:

```text
login
-> dashboard
-> create link
-> metadata preview
-> open short link
-> countdown
-> stop redirect
```

## 23. Observability

MVP:ssä riittävät rakenteelliset lokit, esimerkiksi:

```text
INFO  link created code=a8K3x
INFO  metadata fetch started code=a8K3x
INFO  metadata fetch completed code=a8K3x
WARN  metadata fetch failed code=a8K3x error=timeout
```

Salasanoja, session tokeneita tai Authorization-header-arvoja ei lokiteta.

## 24. Analytics

MVP ei kerää IP-osoitteita tai user-agentteja.

Schemaan voidaan kuitenkin tallentaa:

- `click_count`
- `last_clicked_at`

Myöhemmin voidaan lisätä erillinen event-taulu, jos tarvitaan tarkempaa analytiikkaa.

## 25. MVP:n ulkopuolelle

Ensimmäiseen versioon ei oteta:

- useita käyttäjätasoja
- käyttäjärekisteröintiä
- Redisia
- API-avaimia
- custom domaineja
- QR-koodeja
- bulk importia
- team-toimintoja
- monimutkaista analyticsia
- expiration-järjestelmää

Custom short codes voidaan kuitenkin ottaa myöhemmin ilman perustavanlaatuista tietokantamuutosta.

## 26. Toteutusjärjestys

### Vaihe 1 — Foundation

- Next.js + TypeScript
- Prisma
- PostgreSQL
- Docker Compose
- `.env.example`
- migrations
- health endpoint
- basic layout

### Vaihe 2 — Authentication

- users
- create-user script
- login/logout
- session
- admin authorization

### Vaihe 3 — Link CRUD

- create
- list
- edit
- deactivate
- delete
- short code generation

### Vaihe 4 — Public page

- `/s/[code]`
- SSR
- countdown
- stop button
- responsive UI
- target URL

### Vaihe 5 — Metadata

- HTTP fetcher
- HTML parser
- metadata persistence
- admin preview
- redirect page preview

### Vaihe 6 — Playwright

- screenshot
- JavaScript-rendered fallback
- persistent screenshot storage
- worker

### Vaihe 7 — Social sharing

- Open Graph
- Twitter Card
- generated preview fallback
- noindex

### Vaihe 8 — Refresh

- job table
- worker queue
- daily refresh
- content hash

### Vaihe 9 — Hardening

- SSRF protection
- fetch limits
- rate limiting where needed
- authentication hardening
- security headers
- robust error handling

### Vaihe 10 — Production

- production Dockerfile
- external PostgreSQL
- persistent screenshot volume
- migration deployment
- reverse proxy configuration
- backup documentation

## 27. Periaate

Pidetään palvelu pienenä: yksi repository, yksi TypeScript-sovellus, yksi PostgreSQL ja yksi worker-prosessi. Worker voidaan myöhemmin erottaa omaksi palvelukseen ilman, että sovelluksen tietomallia tarvitsee suunnitella uusiksi.

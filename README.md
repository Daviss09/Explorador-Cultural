# Explorador Cultural — Mapa Cultural Interativo do Brasil

Aplicação web GIS em tempo real para mapear manifestações culturais em todos os municípios do Brasil usando **Leaflet.js**, **TopoJSON (`topojson-client`)**, malhas oficiais da **API v3 do IBGE** e persistência no banco **MySQL (`exploradorcultural`)** via **PHP / PDO**.

---

## Arquitetura do Mapa e Camadas

1. **Mapa Base:** CartoDB Positron No Labels (`light_nolabels`), centralizado em `[-14.235, -51.925]` com zoom inicial `4` e renderização em Canvas (`preferCanvas: true`).
2. **Camada 1 — Regiões (`regioesPane`, z-index `410`):** Polígonos das 5 macrorregiões do Brasil sem bordas (`fillOpacity: 0.6`), coloridos por região (Norte `#a8e6cf`, Nordeste `#ffd3b6`, Centro-Oeste `#ffaaa5`, Sudeste `#dcedc1`, Sul `#a8d8ea`).
3. **Camada 2 — Estados (`estadosPane`, z-index `420`):** Contorno das 27 UFs (`color: '#333333'`, `weight: 2`, `fillOpacity: 0`).
4. **Camada 3 — Municípios (`municipiosPane`, z-index `430`):** Contorno das cidades (`color: '#666666'`, `weight: 0.5`, `fillOpacity: 0`) exibido a partir do **zoom 6**. Clicar em qualquer município (ou clicar no mapa em zoom `< 6`, que aproxima automaticamente) abre o formulário com cidade e UF preenchidas.

---

## Persistência no Banco de Dados (MySQL / PDO)

O projeto utiliza a conexão já configurada em `config/database.php` (`App\Models\Database`):

1. A tabela `pins_culturais` é criada automaticamente na primeira requisição caso ainda não exista no banco `exploradorcultural` (ou pode ser importada manualmente via [`database/pins_culturais.sql`](./database/pins_culturais.sql)).
2. Endpoints REST internos:
   - `GET /pins` (suporta `?afterId=<id>` para sincronização incremental a cada 4s)
   - `POST /pins` (protegido por token CSRF `X-CSRF-Token`, *prepared statements* PDO e validação estrita de tamanho, categoria permitida e coordenadas no Brasil)

---

## Executando Localmente

### Via XAMPP (Apache + MySQL)
1. Inicie os módulos **Apache** e **MySQL** no XAMPP Control Panel.
2. Verifique suas credenciais em `config/database.php` (a partir de `config/database.example.php`).
3. Acesse `http://localhost/Explorador-Cultural/`.

### Via servidor embutido do PHP (alternativa rápida)
```bash
C:\xampp\php\php.exe -S 127.0.0.1:8080 -t public
```
Depois abra `http://127.0.0.1:8080/` (mantendo o MySQL do XAMPP iniciado).

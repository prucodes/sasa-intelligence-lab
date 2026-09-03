/**
 * Seed crosswalk decisions — the reviewer working copy baked into the build.
 *
 * Crosswalk decisions live in localStorage, which a static host starts empty, so the
 * finished review (78 approvals recovering the previously-unreachable observations)
 * would otherwise be invisible to every visitor. This is that review, loaded whenever
 * localStorage holds nothing; a reviewer who edits still overrides it in their browser.
 *
 * The three East Godavari Rajamahendravaram spellings, deferred during review, are
 * resolved here to ulb_id 28 (Rajahmundry / Rajamahendravaram, East Godavari) — the same
 * city renamed. Rajam (105) and Rajampet (49) are different towns and are left alone.
 *
 * Generated from the reviewer artifact; edit the workbench and re-export to change it.
 */
import type { Decision } from './crosswalk';

export const seedDecisions: Record<string, Decision> = {
  "vizianagaram|bobbili": {
    "itemId": "vizianagaram|bobbili",
    "state": "approved",
    "ulbId": "110",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "tirupati|tirupati": {
    "itemId": "tirupati|tirupati",
    "state": "approved",
    "ulbId": "22",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "srikakulam|palasakasibugga": {
    "itemId": "srikakulam|palasakasibugga",
    "state": "approved",
    "ulbId": "104",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "prakasam|addanki": {
    "itemId": "prakasam|addanki",
    "state": "approved",
    "ulbId": "163",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "guntur|mangalagiritadepalli": {
    "itemId": "guntur|mangalagiritadepalli",
    "state": "approved",
    "ulbId": "36",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "anantapur|anantapur": {
    "itemId": "anantapur|anantapur",
    "state": "approved",
    "ulbId": "8",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "palnadu|gurazala": {
    "itemId": "palnadu|gurazala",
    "state": "approved",
    "ulbId": "206",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "annamayya|rayachoti": {
    "itemId": "annamayya|rayachoti",
    "state": "approved",
    "ulbId": "50",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "kakinada|samalkota": {
    "itemId": "kakinada|samalkota",
    "state": "approved",
    "ulbId": "30",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "tirupati|srikalahasti": {
    "itemId": "tirupati|srikalahasti",
    "state": "approved",
    "ulbId": "21",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "eastgodavari|mandapeta": {
    "itemId": "eastgodavari|mandapeta",
    "state": "approved",
    "ulbId": "25",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "tirupati|naidupeta": {
    "itemId": "tirupati|naidupeta",
    "state": "approved",
    "ulbId": "200",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "srisatyasai|puttaparthi": {
    "itemId": "srisatyasai|puttaparthi",
    "state": "approved",
    "ulbId": "148",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "palnadu|chilakaluripeta": {
    "itemId": "palnadu|chilakaluripeta",
    "state": "approved",
    "ulbId": "33",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ntr|jaggaiahpet": {
    "itemId": "ntr|jaggaiahpet",
    "state": "approved",
    "ulbId": "65",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ntr|kondpalli": {
    "itemId": "ntr|kondpalli",
    "state": "approved",
    "ulbId": "211",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "drbrambedkarkonaseema|mummidivaram": {
    "itemId": "drbrambedkarkonaseema|mummidivaram",
    "state": "approved",
    "ulbId": "150",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "palnadu|narsaraopet": {
    "itemId": "palnadu|narsaraopet",
    "state": "approved",
    "ulbId": "37",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "chittoor|palamaner": {
    "itemId": "chittoor|palamaner",
    "state": "approved",
    "ulbId": "18",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "parvathipurammanyam|palkonda": {
    "itemId": "parvathipurammanyam|palkonda",
    "state": "approved",
    "ulbId": "203",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "tirupati|sullurpeta": {
    "itemId": "tirupati|sullurpeta",
    "state": "approved",
    "ulbId": "184",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "krishna|ysrtadigada": {
    "itemId": "krishna|ysrtadigada",
    "state": "approved",
    "ulbId": "217",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "palnadu|narasaraopeta": {
    "itemId": "palnadu|narasaraopeta",
    "state": "approved",
    "ulbId": "37",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "srikakulam|amudalavalasa": {
    "itemId": "srikakulam|amudalavalasa",
    "state": "approved",
    "ulbId": "102",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "spsrnellore|gudurn": {
    "itemId": "spsrnellore|gudurn",
    "state": "approved",
    "ulbId": "88",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "eastgodavari|nidadavolu": {
    "itemId": "eastgodavari|nidadavolu",
    "state": "approved",
    "ulbId": "120",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "markapuram|giddaluru": {
    "itemId": "markapuram|giddaluru",
    "state": "approved",
    "ulbId": "165",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "spsrnellore|atmakurnlr": {
    "itemId": "spsrnellore|atmakurnlr",
    "state": "approved",
    "ulbId": "183",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "kakinada|gollaprolu": {
    "itemId": "kakinada|gollaprolu",
    "state": "approved",
    "ulbId": "149",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "kakinada|gollaprolunp": {
    "itemId": "kakinada|gollaprolunp",
    "state": "approved",
    "ulbId": "149",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ntr|jaggaiahpeta": {
    "itemId": "ntr|jaggaiahpeta",
    "state": "approved",
    "ulbId": "65",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ntr|jaggiahpeta": {
    "itemId": "ntr|jaggiahpeta",
    "state": "approved",
    "ulbId": "65",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "eastgodavari|kovvuru": {
    "itemId": "eastgodavari|kovvuru",
    "state": "approved",
    "ulbId": "118",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "nandyal|nandyala": {
    "itemId": "nandyal|nandyala",
    "state": "approved",
    "ulbId": "73",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "guntur|ponnuru": {
    "itemId": "guntur|ponnuru",
    "state": "approved",
    "ulbId": "39",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "palnadu|sattenapalle": {
    "itemId": "palnadu|sattenapalle",
    "state": "approved",
    "ulbId": "41",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "krishna|tadigadapa": {
    "itemId": "krishna|tadigadapa",
    "state": "approved",
    "ulbId": "217",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "anakapalli|yelamanchali": {
    "itemId": "anakapalli|yelamanchali",
    "state": "approved",
    "ulbId": "182",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "srikakulam|ichchapuram": {
    "itemId": "srikakulam|ichchapuram",
    "state": "approved",
    "ulbId": "103",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "westgodavari|narasapur": {
    "itemId": "westgodavari|narasapur",
    "state": "approved",
    "ulbId": "119",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "anakapalli|yelamanchili": {
    "itemId": "anakapalli|yelamanchili",
    "state": "approved",
    "ulbId": "182",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ysrkadapa|jammalamadugu": {
    "itemId": "ysrkadapa|jammalamadugu",
    "state": "approved",
    "ulbId": "45",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "spsrnellore|alluru": {
    "itemId": "spsrnellore|alluru",
    "state": "rejected",
    "ulbId": null,
    "decidedAt": "2026-09-02T21:23:31.118Z"
  },
  "kurnool|gudurk": {
    "itemId": "kurnool|gudurk",
    "state": "approved",
    "ulbId": "156",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "kadapa|jammalamadugu": {
    "itemId": "kadapa|jammalamadugu",
    "state": "approved",
    "ulbId": "45",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "anantapur|kalyanadurgam": {
    "itemId": "anantapur|kalyanadurgam",
    "state": "approved",
    "ulbId": "189",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "westgodavaridistrict|akivedu": {
    "itemId": "westgodavaridistrict|akivedu",
    "state": "approved",
    "ulbId": "208",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "nellore|alluru": {
    "itemId": "nellore|alluru",
    "state": "rejected",
    "ulbId": null,
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "nandyala|atmakurk": {
    "itemId": "nandyala|atmakurk",
    "state": "approved",
    "ulbId": "176",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "nandyala|bethamcharla": {
    "itemId": "nandyala|bethamcharla",
    "state": "approved",
    "ulbId": "210",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "tirupati|gudurtpt": {
    "itemId": "tirupati|gudurtpt",
    "state": "approved",
    "ulbId": "88",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ananthapur|kalyanadurgam": {
    "itemId": "ananthapur|kalyanadurgam",
    "state": "approved",
    "ulbId": "189",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "prakasam|kandhukuru": {
    "itemId": "prakasam|kandhukuru",
    "state": "approved",
    "ulbId": "97",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ambedkarkonaseema|mandapeta": {
    "itemId": "ambedkarkonaseema|mandapeta",
    "state": "approved",
    "ulbId": "25",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ambedkarkonaseema|mummidivaram": {
    "itemId": "ambedkarkonaseema|mummidivaram",
    "state": "approved",
    "ulbId": "150",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "annamayya|pungunur": {
    "itemId": "annamayya|pungunur",
    "state": "approved",
    "ulbId": "19",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ysrkadapa|rajampeta": {
    "itemId": "ysrkadapa|rajampeta",
    "state": "approved",
    "ulbId": "49",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "nandyal|atmakurk": {
    "itemId": "nandyal|atmakurk",
    "state": "approved",
    "ulbId": "176",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "spsrnellore|gudurnlr": {
    "itemId": "spsrnellore|gudurnlr",
    "state": "approved",
    "ulbId": "88",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "eluru|nuzvid": {
    "itemId": "eluru|nuzvid",
    "state": "approved",
    "ulbId": "67",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "kurnool|gudurknl": {
    "itemId": "kurnool|gudurknl",
    "state": "approved",
    "ulbId": "156",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "anantapuram|ananthapuramu": {
    "itemId": "anantapuram|ananthapuramu",
    "state": "approved",
    "ulbId": "8",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "nandyal|atmakur": {
    "itemId": "nandyal|atmakur",
    "state": "approved",
    "ulbId": "176",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "nandyal|atmakurknl": {
    "itemId": "nandyal|atmakurknl",
    "state": "approved",
    "ulbId": "176",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "kurnool|atmakurk": {
    "itemId": "kurnool|atmakurk",
    "state": "approved",
    "ulbId": "176",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "tirupati|gudurn": {
    "itemId": "tirupati|gudurn",
    "state": "approved",
    "ulbId": "88",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "kurnool|guduruk": {
    "itemId": "kurnool|guduruk",
    "state": "approved",
    "ulbId": "156",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "anantapuram|kalyandurgam": {
    "itemId": "anantapuram|kalyandurgam",
    "state": "approved",
    "ulbId": "189",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "vizianagaram|nellimerla": {
    "itemId": "vizianagaram|nellimerla",
    "state": "approved",
    "ulbId": "202",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ntr|jaggaipeta": {
    "itemId": "ntr|jaggaipeta",
    "state": "approved",
    "ulbId": "65",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "westgodavaridistrict|palacole": {
    "itemId": "westgodavaridistrict|palacole",
    "state": "approved",
    "ulbId": "121",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ntr|jaggayyapeta": {
    "itemId": "ntr|jaggayyapeta",
    "state": "approved",
    "ulbId": "65",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "westgodavari|palacole": {
    "itemId": "westgodavari|palacole",
    "state": "approved",
    "ulbId": "121",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "eastgodavari|rajamahendravaram": {
    "itemId": "eastgodavari|rajamahendravaram",
    "state": "approved",
    "ulbId": "28",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "eastgodavari|rajamahendravarm": {
    "itemId": "eastgodavari|rajamahendravarm",
    "state": "approved",
    "ulbId": "28",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "eastgodavari|rajahmahendravaram": {
    "itemId": "eastgodavari|rajahmahendravaram",
    "state": "approved",
    "ulbId": "28",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "visakhapatnam|visakhapatnam": {
    "itemId": "visakhapatnam|visakhapatnam",
    "state": "approved",
    "ulbId": "109",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "visakhapatnam|gvmcvisakhapatnam": {
    "itemId": "visakhapatnam|gvmcvisakhapatnam",
    "state": "approved",
    "ulbId": "109",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "markapuram|podili": {
    "itemId": "markapuram|podili",
    "state": "rejected",
    "ulbId": null,
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "prakasam|podili": {
    "itemId": "prakasam|podili",
    "state": "rejected",
    "ulbId": null,
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "annamayya|bkothakota": {
    "itemId": "annamayya|bkothakota",
    "state": "approved",
    "ulbId": "16",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  },
  "ntr|vijayawada": {
    "itemId": "ntr|vijayawada",
    "state": "approved",
    "ulbId": "69",
    "decidedAt": "2026-09-02T21:23:31.119Z"
  }
};

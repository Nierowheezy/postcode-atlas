# Ask Atlas evaluation benchmark

- Target: http://localhost:3001/
- Date: 2026-10-13T17:16:07.413Z
- Result: **36/37 passed**

| Group | Passed | Total |
|-------|--------|-------|
| core | 6 | 6 |
| tool-accuracy | 8 | 9 |
| regional-terms | 5 | 5 |
| ambiguity | 8 | 8 |
| languages | 9 | 9 |

| # | Case | Expectation | Result | Grounding |
|---|------|-------------|--------|-----------|
| 1 | Postcode for Ikeja, Lagos | honest LGA answer, no invented postcode | PASS | Verified against NIPOST |
| 2 | List the LGAs in Kano | grounded LGA list for Kano | PASS | Verified against NIPOST |
| 3 | Show Kano state on the map | map frames Kano (breadcrumb + zoom change) | PASS | Map moved (NIPOST location data) |
| 4 | Decode FC-02-D43-LG-01 | five-part NDAPS breakdown | PASS | Verified against NIPOST |
| 5 | Where is Wuse 2? | Abuja/FCT location, grounded or honest | PASS | Answered from NIPOST tool results |
| 6 | Landmark postcode lookup | verified landmark postcode or honest | PASS | Verified against NIPOST |
| 7 | Show Lagos on the map | map frames Lagos (breadcrumb + zoom change) | PASS | Map moved (NIPOST location data) |
| 8 | Greeting | friendly, no tool call, no data | PASS | No data footer |
| 9 | Out-of-scope question | graceful refusal, no invented data | PASS | Not verified |
| 10 | Ambiguous: "Lagos" | resolves or asks; never a fake postcode | PASS | Verified against NIPOST |
| 11 | Ambiguous: "Port Harcourt" | honest city/LGA answer | PASS | Answered from NIPOST tool results |
| 12 | Ambiguous: "Wuse" | narrows or resolves; no invented postcode | PASS | Answered from NIPOST tool results |
| 13 | Bare LGA: "Ikeja" | asks for a specific area, no invented postcode | PASS | Verified against NIPOST |
| 14 | Ambiguous: "Delta" | state, not a postcode | PASS | Verified against NIPOST |
| 15 | Postcode for Lagos state | says a state has no single postcode | FAIL | Not verified |
| 16 | Follow-up: "what are its districts?" | resolves "its" to Kano | PASS | Verified against NIPOST |
| 17 | Yoruba: postcode for Ikeja | auto-detects Yoruba, guarded no-postcode reply, natlas | PASS | Verified against NIPOST |
| 18 | Hausa: postcode for Ikeja | auto-detects Hausa, guarded no-postcode reply, natlas | PASS | Verified against NIPOST |
| 19 | Igbo: postcode for Ikeja | auto-detects Igbo, guarded no-postcode reply, natlas | PASS | Verified against NIPOST |
| 20 | Yoruba greeting | small talk, no tool call | PASS | No data footer |
| 21 | Pidgin: postcode for Ikeja | Pidgin detected, English reply, grounded | PASS | Verified against NIPOST |
| 22 | Pidgin: show Lagos on the map | Pidgin detected, map frames Lagos | PASS | Map moved (NIPOST location data) |
| 23 | Pidgin: postcode for Ojota | Pidgin detected, grounded or honest, no invented code | PASS | Answered from NIPOST tool results |
| 24 | Code-mixed: Yoruba and English postcode | code-mixed query still auto-detects Yoruba, no invented code | PASS | Verified against NIPOST |
| 25 | Igbo: list the LGAs in Kano | auto-detects Igbo, grounded LGA list for Kano | PASS | Verified against NIPOST |
| 26 | Regional term: Computer Village, Ikeja | locates the market and stays grounded or honest | PASS | Answered from NIPOST tool results |
| 27 | Regional term: Lekki Phase 1 | locates the Lagos district and stays grounded or honest | PASS | Not verified |
| 28 | Regional term: GRA (many states) | names it as a local-area term, invents no single code | PASS | Answered from NIPOST tool results |
| 29 | Regional term: Nsukka | places Nsukka in Enugu, grounded or honest | PASS | Verified against NIPOST |
| 30 | Ambiguous: bare "Kano" | state, city or LGA resolved without inventing a postcode | PASS | Verified against NIPOST |
| 31 | Ambiguous: bare "Abeokuta" | capital and LGAs of the same name resolved without inventing a code | PASS | Verified against NIPOST |
| 32 | Ambiguous: bare "Eket" | Akwa Ibom LGA resolved without inventing a code | PASS | Verified against NIPOST |
| 33 | Tool: decode LA-11-A12-AK-08 | names all five NDAPS parts and grounds the code | PASS | Verified against NIPOST |
| 34 | Tool: nearby postcodes around Wuse 2 | nearby tool results or an honest alternative, nothing fabricated | PASS | Answered from NIPOST tool results |
| 35 | Tool: NDAPS explanation is editorial | editorial answer, makes no NIPOST verification claim | PASS | No data footer |
| 36 | Tool: paste an address | places the address in Ikeja, Lagos, and invents no postcode | PASS | Verified against NIPOST |
| 37 | Tool: districts for an unknown LGA | honest not-found, never invented rows or a postcode | PASS | Not verified |

## Changes since the last run

- Regressions: #15
- Fixed: #37

## Replies

### #1 Postcode for Ikeja, Lagos - PASS

> Ikeja is a Local Government Area, so it has no single postcode. Tell me a specific area, street, or landmark and I will find its unit postcode.

### #2 List the LGAs in Kano - PASS

> The LGAs in Kano are Ajingi, Albasu, Bagwai, Bebeji, Bichi, Bunkure, Dala, Dambatta, Dawakin Kudu, Dawakin Tofa, Doguwa, Fagge, Gabasawa, Garko, Garum Mallam, Gaya, Gezawa, Gwale, Gwarzo, Kabo, Kano Municipal, Karaye, Kibiya, Kiru, Kumbotso, Kunchi, Kura, Madobi, Makoda, Minjibir, Nasarawa, Rano, Rimin Gado, Rogo, Shanono, Sumaila, Takai, Tarauni, Tofa, Tsanyawa, Tudun Wada, Ungogo, Warawa, and Wudil.

### #3 Show Kano state on the map - PASS

> Showing Kano on the map.

### #4 Decode FC-02-D43-LG-01 - PASS

> The postcode "FC-02-D43-LG-01" is valid and corresponds to the Federal Capital Territory (FCT) in Abuja Municipal, with the district of D43, area of LG, and unit of 01. Its coordinates are 9.057977, 7.493727.

### #5 Where is Wuse 2? - PASS

> Wuse 2 does not have a specific postcode. However, the area is located in Abuja, Nigeria.

### #6 Landmark postcode lookup - PASS

> The Infrastructure Bank PLC is located at FC-02-D43-LG-01.

### #7 Show Lagos on the map - PASS

> Showing Lagos on the map.

### #8 Greeting - PASS

> Hello! I'm here to help you with any Nigerian place or postcode queries. Please ask a specific question or provide some details so I can assist you better.

### #9 Out-of-scope question - PASS

> I'm sorry, but I cannot help with weather information. I can answer questions about Nigerian postcodes, places, and the Atlas platform. Would you like to know the postcode for Lagos or a specific location?

### #10 Ambiguous: "Lagos" - PASS

> Lagos is a state in Nigeria. It has two Local Government Areas (LGAs): Lagos Island (code 14) and Lagos Mainland (code 15).

### #11 Ambiguous: "Port Harcourt" - PASS

> Port Harcourt is not found in the Atlas data. Could you please provide a more specific location or area?

### #12 Ambiguous: "Wuse" - PASS

> Wuse is not a recognized place. Please provide a specific area or landmark within Abuja.

### #13 Bare LGA: "Ikeja" - PASS

> Ikeja is an LGA in Lagos State with the code 11.

### #14 Ambiguous: "Delta" - PASS

> Ikeja is a Local Government Area (LGA) in Lagos State. It has no single postcode, but you can look up specific areas within Ikeja to find the exact postcode. For example, you can ask for the postcode of Ikeja GRA, Ikeja Cantonment, or other areas.

### #15 Postcode for Lagos state - FAIL

> However, this is not a valid postcode.

Failures: did not address Lagos

### #16 Follow-up: "what are its districts?" - PASS

> The district of Ajingi LGA in Kano State is as follows: 1. A01 2. A02 3. A03 4. A04 5. A05 6. A06 7. A07 8. A08 9. A09 10. A10 11. A11 12. A12 13. A13 14. A14 15. A15 16. A16 17. A17 18. A18 19. A19 20. A20 Please note that this result is partial and contains 20 out of a total of 208 districts. To see the rest of the districts, please narrow your search scope.

### #17 Yoruba: postcode for Ikeja - PASS

> Ikeja jẹ Agbegbe Ijoba Ibile, nitori naa ko ni koodu kan soso. Sọ fun mi ni agbegbe kan pato, opopona, tabi ami-ilẹ kan, ki n le wa koodu rẹ.

### #18 Hausa: postcode for Ikeja - PASS

> Ikeja Karamar Hukuma ce, saboda haka ba shi da wata lambar gidan waya guda daya. Gaya mini wani takamaiman yanki, titi, ko alama, zan nemo lambar gidan waya ta.

### #19 Igbo: postcode for Ikeja - PASS

> Ikeja bụ Ọchịchị Ime Obodo, ya mere o nweghị otu koodu ozi. Gwa m otu mpaghara, okporo ụzọ, ma ọ bụ ebe ama, m ga-achọta koodu ozi ya.

### #20 Yoruba greeting - PASS

> Bawo ni! Bawo ni mo ṣe le ran ọ lọwọ pẹlu koodu ifiweranse tabi ipo kan ni Naijiria?

### #21 Pidgin: postcode for Ikeja - PASS

> Ikeja is a Local Government Area, so it has no single postcode. Tell me a specific area, street, or landmark and I will find its unit postcode.

### #22 Pidgin: show Lagos on the map - PASS

> Showing Lagos on the map.

### #23 Pidgin: postcode for Ojota - PASS

> Ojota has no single postcode. Could you please provide a more specific area or landmark?

### #24 Code-mixed: Yoruba and English postcode - PASS

> Ikeja jẹ Agbegbe Ijoba Ibile, nitori naa ko ni koodu kan soso. Sọ fun mi ni agbegbe kan pato, opopona, tabi ami-ilẹ kan, ki n le wa koodu rẹ.

### #25 Igbo: list the LGAs in Kano - PASS

> E nwere LGA iri anọ na atọ dị na Kano, ha bụ: Ajingi, Albasu, Bagwai, Bebeji, Bichi, Bunkure, Dala, Dambatta, Dawakin Kudu, Dawakin Tofa, Doguwa, Fagge, Gabasawa, Garko, Garum Mallam, Gaya, Gezawa, Gwale, Gwarzo, Kabo, Kano Municipal, Karaye, Kibiya, Kiru, Kumbotso, Kunchi, Kura, Madobi, Makoda, Minjibir, Nasarawa, Rano, Rimin Gado, Rogo, Shanono, Sumaila, Takai, Tarauni, Tofa, Tsanyawa, Tudun Wada, Ungogo, Warawa, na Wudil.

### #26 Regional term: Computer Village, Ikeja - PASS

> The postcode for Computer Village, Ikeja is not available.

### #27 Regional term: Lekki Phase 1 - PASS

> I could not verify a postcode for that from the available data. Ask for a specific area, street, or landmark.

### #28 Regional term: GRA (many states) - PASS

> The GRA in Port Harcourt does not have a specific postcode.

### #29 Regional term: Nsukka - PASS

> Nsukka is located in Enugu State, Nigeria. It is an LGA in the state.

### #30 Ambiguous: bare "Kano" - PASS

> Kano is a state in Nigeria, with the Kano Municipal Local Government Area (LGA) as one of its localities.

### #31 Ambiguous: bare "Abeokuta" - PASS

> Abeokuta is in Ogun State. The two Local Government Areas (LGAs) in Abeokuta are Abeokuta North and Abeokuta South.

### #32 Ambiguous: bare "Eket" - PASS

> Eket is a Local Government Area (LGA) in Akwa Ibom State, Nigeria. It has the LGA code 03 and is part of Akwa Ibom state.

### #33 Tool: decode LA-11-A12-AK-08 - PASS

> The postcode LA-11-A12-AK-08 is in Lagos State, Ikeja LGA, A12 district, AK area, and unit 08.

### #34 Tool: nearby postcodes around Wuse 2 - PASS

> There are no postcodes within 300 meters of Wuse 2, Abuja.

### #35 Tool: NDAPS explanation is editorial - PASS

> The National Digital Alphanumeric Postcode System, or NDAPS, is the addressing standard for Nigeria, developed by NIPOST. It assigns an 11-character alphanumeric digital address to every addressable building in the country and is GIS-located, tying each building to precise coordinates for address identity and postal routing.

### #36 Tool: paste an address - PASS

> 12 Allen Avenue is in Ikeja, Lagos State. The postcode for this area is 11 02 04 01 02.

### #37 Tool: districts for an unknown LGA - PASS

> There is no district in Nowhereville, Lagos.

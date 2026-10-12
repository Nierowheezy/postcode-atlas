# Ask Atlas evaluation benchmark

- Target: http://localhost:3001/
- Date: 2026-10-12T08:45:55.034Z
- Result: **21/21 passed**

| # | Case | Expectation | Result | Grounding |
|---|------|-------------|--------|-----------|
| 1 | Postcode for Ikeja, Lagos | honest LGA answer, no invented postcode | PASS | Verified against NIPOST |
| 2 | List the LGAs in Kano | grounded LGA list for Kano | PASS | Verified against NIPOST |
| 3 | Show Kano state on the map | map frames Kano (breadcrumb + zoom change) | PASS | Map moved (NIPOST location data) |
| 4 | Decode FC-02-D43-LG-01 | five-part NDAPS breakdown | PASS | Verified against NIPOST |
| 5 | Where is Wuse 2? | Abuja/FCT location, grounded or honest | PASS | Answered from NIPOST tool results |
| 6 | Landmark postcode lookup | verified landmark postcode or honest | PASS | Not verified |
| 7 | Show Lagos on the map | map frames Lagos (breadcrumb + zoom change) | PASS | Map moved (NIPOST location data) |
| 8 | Greeting | friendly, no tool call, no data | PASS | No data footer |
| 9 | Out-of-scope question | graceful refusal, no invented data | PASS | Not verified |
| 10 | Ambiguous: "Lagos" | resolves or asks; never a fake postcode | PASS | Verified against NIPOST |
| 11 | Ambiguous: "Port Harcourt" | honest city/LGA answer | PASS | Answered from NIPOST tool results |
| 12 | Ambiguous: "Wuse" | narrows or resolves; no invented postcode | PASS | Not verified |
| 13 | Bare LGA: "Ikeja" | asks for a specific area, no invented postcode | PASS | Verified against NIPOST |
| 14 | Ambiguous: "Delta" | state, not a postcode | PASS | Map moved (NIPOST location data) |
| 15 | Postcode for Lagos state | says a state has no single postcode | PASS | Not verified |
| 16 | Follow-up: "what are its districts?" | resolves "its" to Kano | PASS | Verified against NIPOST |
| 17 | Yoruba: postcode for Ikeja | auto-detects Yoruba, no invented code, natlas | PASS | Not verified |
| 18 | Hausa: postcode for Ikeja | auto-detects Hausa, no invented code, natlas | PASS | Not verified |
| 19 | Igbo: postcode for Ikeja | auto-detects Igbo, no invented code, natlas | PASS | Verified against NIPOST |
| 20 | Yoruba greeting | small talk, no tool call | PASS | No data footer |
| 21 | Pidgin: postcode for Ikeja | Pidgin detected, English reply, grounded | PASS | Verified against NIPOST |

## Replies

### #1 Postcode for Ikeja, Lagos - PASS

> Ikeja is a Local Government Area, so it has no single postcode. Tell me a specific area, street, or landmark and I will find its unit postcode.

### #2 List the LGAs in Kano - PASS

> The LGAs in Kano are Ajingi, Albasu, Bagwai, Bebeji, Bichi, Bunkure, Dala, Dambatta, Dawakin Kudu, Dawakin Tofa, Doguwa, Fagge, Gabasawa, Garko, Garum Mallam, Gaya, Gezawa, Gwale, Gwarzo, Kabo, Kano Municipal, Karaye, Kibiya, Kiru, Kumbotso, Kunchi, Kura, Madobi, Makoda, Minjibir, Nasarawa, Rano, Rimin Gado, Rogo, Shanono, Sumaila, Takai, Tarauni, Tofa, Tsanyawa, Tudun Wada, Ungogo, Warawa, and Wudil.

### #3 Show Kano state on the map - PASS

> Showing Kano on the map.

### #4 Decode FC-02-D43-LG-01 - PASS

> The postcode FC-02-D43-LG-01 is in the Federal Capital Territory, Abuja Municipal, Abuja, and is valid.

### #5 Where is Wuse 2? - PASS

> Wuse 2 is a location in Abuja, Nigeria. It is a popular area known for its commercial and residential activities.

### #6 Landmark postcode lookup - PASS

> The Infrastructure Bank PLC does not have a postcode. Please provide a specific area, street, or landmark for a more accurate postcode.

### #7 Show Lagos on the map - PASS

> Showing Lagos on the map.

### #8 Greeting - PASS

> Hello! I'm here to help you find Nigerian postcodes, places, or guide you on the map. Please ask me a specific question about a place or postcode, and I'll do my best to assist you!

### #9 Out-of-scope question - PASS

> I'm sorry, I can't help with that. Please ask a question about Nigerian postcodes or places.

### #10 Ambiguous: "Lagos" - PASS

> Lagos is a state in Nigeria. It has two local government areas (LGAs): Lagos Island and Lagos Mainland.

### #11 Ambiguous: "Port Harcourt" - PASS

> Port Harcourt is a city in Nigeria.

### #12 Ambiguous: "Wuse" - PASS

> It seems there is no LGA called "Wuse" in the Federal Capital Territory (FCT). Please provide a different name for the LGA.

### #13 Bare LGA: "Ikeja" - PASS

> Ikeja is an LGA in Lagos State. The postcode for Ikeja is 11, and it is located in the LA state.

### #14 Ambiguous: "Delta" - PASS

> Showing the whole of Nigeria again.

### #15 Postcode for Lagos state - PASS

> Sure, I can help you with a postcode in Nigeria. Can you please provide a specific area, street, or landmark within Lagos?

### #16 Follow-up: "what are its districts?" - PASS

> Ajingi LGA in Kano State has 20 districts.

### #17 Yoruba: postcode for Ikeja - PASS

> Ikeja ko ni koodu. Dipo, o jẹ apakan ti Ipinle Eko, eyiti ko ni koodu nipa ara rẹ. Ti o ba nilo koodu kan pato, jọwọ pese orukọ ti opopona, agbegbe, tabi agbegbe laarin Ikeja.

### #18 Hausa: postcode for Ikeja - PASS

> I could not verify a postcode for that from the available data. Ask for a specific area, street, or landmark.

### #19 Igbo: postcode for Ikeja - PASS

> Ikeja bụ Local Government Area (LGA) dị na Lagos State. Koodu ozi ya bụ 11.

### #20 Yoruba greeting - PASS

> Kí ló dé tí o fi ń béèrè nípa kóòdù pósítì àti ibi ní Nàìjíríà? O le béèrè nípa pósítì àgbègbè kan, bíi, “Kí ni kóòdù pósítì fún Ìkẹ́kọ̀ọ́” tàbí “Níbo ni Banki Ilé-iṣẹ́ Ẹ̀rọ wa wà.” Tí o bá mọ ibi kan pàtó, o lè sọ fún mi, mo sì lè fún ọ ní ìtọ́sọ́nà pósítì rẹ̀.

### #21 Pidgin: postcode for Ikeja - PASS

> Ikeja is a Local Government Area, so it has no single postcode. Tell me a specific area, street, or landmark and I will find its unit postcode.

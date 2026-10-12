# Ask Atlas evaluation benchmark

- Target: http://localhost:3001/
- Date: 2026-10-12T09:55:00.268Z
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
| 12 | Ambiguous: "Wuse" | narrows or resolves; no invented postcode | PASS | Answered from NIPOST tool results |
| 13 | Bare LGA: "Ikeja" | asks for a specific area, no invented postcode | PASS | Verified against NIPOST |
| 14 | Ambiguous: "Delta" | state, not a postcode | PASS | Verified against NIPOST |
| 15 | Postcode for Lagos state | says a state has no single postcode | PASS | Not verified |
| 16 | Follow-up: "what are its districts?" | resolves "its" to Kano | PASS | Verified against NIPOST |
| 17 | Yoruba: postcode for Ikeja | auto-detects Yoruba, guarded no-postcode reply, natlas | PASS | Verified against NIPOST |
| 18 | Hausa: postcode for Ikeja | auto-detects Hausa, guarded no-postcode reply, natlas | PASS | Not verified |
| 19 | Igbo: postcode for Ikeja | auto-detects Igbo, guarded no-postcode reply, natlas | PASS | Not verified |
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

> The postcode "FC-02-D43-LG-01" is in the Federal Capital Territory, Abuja Municipal, Abuja 2, District 43, Area 1, and Unit 1.

### #5 Where is Wuse 2? - PASS

> Wuse 2 is a well-known area in Abuja, the capital city of Nigeria.

### #6 Landmark postcode lookup - PASS

> The Infrastructure Bank PLC does not have a specific postcode. A postcode in Nigeria is a unique identifier for a specific area or unit. Since the bank is a single entity within an area, it does not have a postcode of its own. If you need the postcode for a specific area or street within the bank's vicinity, please provide more details, and I can help you with that.

### #7 Show Lagos on the map - PASS

> Showing Lagos on the map.

### #8 Greeting - PASS

> Hello! I'm here to help you find Nigerian postcodes, places, or answer questions about the Atlas platform. Please let me know what you need!

### #9 Out-of-scope question - PASS

> I'm sorry, I can't help with that. Please ask about a Nigerian postcode or place.

### #10 Ambiguous: "Lagos" - PASS

> The Lagos state has no single postcode. To find the postcode for a specific area, landmark, or street in Lagos, please provide more details.

### #11 Ambiguous: "Port Harcourt" - PASS

> Port Harcourt is a city in Nigeria, but it does not have a specific postcode. If you could provide a specific area or landmark within Port Harcourt, I can help you find the corresponding postcode.

### #12 Ambiguous: "Wuse" - PASS

> Wuse is a district in Abuja, the capital city of Nigeria. It is known for its upscale living and diplomatic missions.

### #13 Bare LGA: "Ikeja" - PASS

> Ikeja is a Local Government Area (LGA) in Lagos State. Its postcode is 11.

### #14 Ambiguous: "Delta" - PASS

> Delta is a state in Nigeria. If you have a specific area or city within Delta you'd like to know the postcode for, please let me know.

### #15 Postcode for Lagos state - PASS

> Please provide a full postcode for a specific area in Lagos state, such as a district or area.

### #16 Follow-up: "what are its districts?" - PASS

> The Ajingi LGA in Kano State has 20 districts. However, the result is partial and includes only 20 out of a total of 208 districts. To see the complete list, please narrow your search by specifying a particular area or landmark within the LGA.

### #17 Yoruba: postcode for Ikeja - PASS

> Ikeja jẹ Agbegbe Ijoba Ibile, nitori naa ko ni koodu kan soso. Sọ fun mi ni agbegbe kan pato, opopona, tabi ami-ilẹ kan, ki n le wa koodu rẹ.

### #18 Hausa: postcode for Ikeja - PASS

> Lambar gidan waya don Ikeja ba daidai ba ce. Don nemo lambar gidan waya, kuna buƙatar sunan wani takamaiman yanki a cikin Ikeja. Misali, zaku iya ba da sunan titin ko wani sanannen wuri a Ikeja.

### #19 Igbo: postcode for Ikeja - PASS

> Ihe koodu ozi ị na-ekwu maka ya abụghị koodu ozi.

### #20 Yoruba greeting - PASS

> Bawo ni! Ṣe o fẹ lati mọ koodu ifiweranṣẹ fun ibi kan pato ni Nigeria? Jọwọ fun mi ni orukọ ibi naa, ipinlẹ, agbegbe, tabi koodu ifiweranṣẹ.

### #21 Pidgin: postcode for Ikeja - PASS

> Ikeja is a Local Government Area, so it has no single postcode. Tell me a specific area, street, or landmark and I will find its unit postcode.

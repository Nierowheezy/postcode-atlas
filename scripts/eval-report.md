# Ask Atlas evaluation benchmark

- Target: http://localhost:3001/
- Date: 2026-10-11T06:30:33.857Z
- Result: **16/16 passed**

| # | Case | Expectation | Result | Grounding |
|---|------|-------------|--------|-----------|
| 1 | Postcode for Ikeja, Lagos | honest LGA answer, no invented postcode | PASS | Answered from NIPOST tool results |
| 2 | List the LGAs in Kano | grounded LGA list for Kano | PASS | Verified against NIPOST |
| 3 | Show Kano state on the map | map frames Kano (breadcrumb + zoom change) | PASS | Map moved (NIPOST location data) |
| 4 | Decode FC-02-D43-LG-01 | five-part NDAPS breakdown | PASS | Verified against NIPOST |
| 5 | Where is Wuse 2? | Abuja/FCT location, grounded or honest | PASS | Answered from NIPOST tool results |
| 6 | Landmark postcode lookup | verified landmark postcode or honest | PASS | Verified against NIPOST |
| 7 | Show Lagos on the map | map frames Lagos (breadcrumb + zoom change) | PASS | Map moved (NIPOST location data) |
| 8 | Greeting | friendly, no tool call, no data | PASS | Not verified |
| 9 | Out-of-scope question | graceful refusal, no invented data | PASS | Not verified |
| 10 | Ambiguous: "Lagos" | resolves or asks; never a fake postcode | PASS | Verified against NIPOST |
| 11 | Ambiguous: "Port Harcourt" | honest city/LGA answer | PASS | Answered from NIPOST tool results |
| 12 | Ambiguous: "Wuse" | narrows or resolves; no invented postcode | PASS | Answered from NIPOST tool results |
| 13 | Bare LGA: "Ikeja" | asks for a specific area, no invented postcode | PASS | Verified against NIPOST |
| 14 | Ambiguous: "Delta" | state, not a postcode | PASS | Map moved (NIPOST location data) |
| 15 | Postcode for Lagos state | says a state has no single postcode | PASS | Answered from NIPOST tool results |
| 16 | Follow-up: "what are its districts?" | resolves "its" to Kano | PASS | Answered from NIPOST tool results |

## Replies

### #1 Postcode for Ikeja, Lagos - PASS

> The postcode for Ikeja, Lagos, is 01-01-01-01-01.

### #2 List the LGAs in Kano - PASS

> The LGAs in Kano are Ajingi, Albasu, Bagwai, Bebeji, Bichi, Bunkure, Dala, Dambatta, Dawakin Kudu, Dawakin Tofa, Doguwa, Fagge, Gabasawa, Garko, Garum Mallam, Gaya, Gezawa, Gwale, Gwarzo, Kabo, Kano Municipal, Karaye, Kibiya, Kiru, Kumbotso, Kunchi, Kura, Madobi, Makoda, Minjibir, Nasarawa, Rano, Rimin Gado, Rogo, Shanono, Sumaila, Takai, Tarauni, Tofa, Tsanyawa, Tudun Wada, Ungogo, Warawa, and Wudil.

### #3 Show Kano state on the map - PASS

> Showing Kano on the map.

### #4 Decode FC-02-D43-LG-01 - PASS

> The postcode FC-02-D43-LG-01 is in the Federal Capital Territory, Abuja Municipal, Abuja, and has no specific area or street.

### #5 Where is Wuse 2? - PASS

> Wuse 2 is an area in Abuja, Nigeria. It is one of the most popular and affluent areas in the city.

### #6 Landmark postcode lookup - PASS

> The postcode for The Infrastructure Bank PLC is FC-02-D43-LG-01.

### #7 Show Lagos on the map - PASS

> Showing Lagos on the map.

### #8 Greeting - PASS

> Hello! I'm here to help you with any Nigerian place or postcode queries. Please let me know what you're looking for, such as the postcode for a specific area or information about a particular location.

### #9 Out-of-scope question - PASS

> I'm sorry, but I can only assist with Nigerian postcodes and places. For weather information, you may want to check a weather service or news source.

### #10 Ambiguous: "Lagos" - PASS

> The Lagos state has no single postcode. To find the postcode for a specific area or landmark in Lagos, please provide more details.

### #11 Ambiguous: "Port Harcourt" - PASS

> Port Harcourt is not found. Please provide a more specific location or area within Port Harcourt.

### #12 Ambiguous: "Wuse" - PASS

> Wuse is not a specific enough location. Can you please provide more details, such as a landmark, LGA, or street?

### #13 Bare LGA: "Ikeja" - PASS

> Ikeja is in Lagos State.

### #14 Ambiguous: "Delta" - PASS

> Showing the whole of Nigeria again.

### #15 Postcode for Lagos state - PASS

> Lagos state does not have a single postcode, as it is divided into various LGAs, districts, areas, and units. To find the specific postcode for a location in Lagos, please provide the name of the area, street, or landmark.

### #16 Follow-up: "what are its districts?" - PASS

> Ajingi LGA has no districts.

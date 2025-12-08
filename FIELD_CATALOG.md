# NetSuite Time Tracking Dataset - Field Catalog

Complete reference of all 56 fields with data types, descriptions, and example values.

---

## 1. Customer/Client Information

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 1 | MKundenavn | String | Customer/Organization name | "Eg Danmark A/S ", "Aura A/S ", "Norlys Group A/S " | Often has trailing space |
| 2 | Name | String | Full project name (Customer : Project) | "Eg Danmark A/S : Catch up - AX2009-->D365" | Composite field |
| 3 | Customer:Project | String | Project code/identifier | "PROJ089083", "PROJ007929" | Format: PROJ followed by 6 digits |

---

## 2. Project Reference Fields

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 4 | EG - External Reference | String | Project task reference ID | "ProjectTask-00000004123836" | Format: ProjectTask-{14-digit number} |
| 5 | Project Type | String (Enum) | Type/category of project | "Internal Product Project", "Customer Standard Project", "Internal Administration Project", "Internal Business Project", "Customer Project", "Customer Support Project" | 6 distinct values observed |
| 6 | Project Name | String | Project short name | "Catch up - AX2009-->D365", "FAIN: EG Administration Project (India)" | |

---

## 3. Time Entry Information

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 7 | Time Tracking | String | Composite time tracking entry | "22.11.2024 : tosan : 1:00" | Format: DD.MM.YYYY : employee : HH:MM |
| 8 | Type | String (Enum) | Entry type | "Actual Time" | Appears to be constant |
| 18 | Duration | String (Time) | Duration in HH:MM format | "01:00", "05:30", "00:15" | Time format with leading zeros |
| 19 | dur_dec | Decimal | Duration in decimal hours | 1, 5,50, 0,25 | Uses comma as decimal separator |
| 20 | Date | Date | Entry date | "22.11.2024", "01.05.2025" | Format: DD.MM.YYYY |
| 29 | Dur_r | Decimal | Duration rounded/calculated | 1, 5,50, 0,30, 0,80 | Similar to dur_dec, may include rounding |
| 38 | Week Of | Date | Week start date | "18.11.2024", "28.04.2025" | Format: DD.MM.YYYY |

---

## 4. Billing & Financial Fields

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 9 | Billable | Boolean | Is entry billable to customer | true, false | Boolean literal |
| 10 | EG - To be IFRS adjusted | Boolean | IFRS accounting flag | true, false | International Financial Reporting Standards |
| 11 | EG - Eligible for Capitalization | Boolean | Can be capitalized as asset | true, false | Relevant for CAPEX tracking |
| 13 | MTYPE | String (Enum) | Main billing type | "CAPEX", "nonbill", "Bill", "IFRS" | 4 primary values |
| 14 | Non-billable | Boolean | Is non-billable | true, false | Inverse of Billable in some cases |
| 15 | Billing Class | String (Enum) | Detailed billing classification | "Software Developer Senior", "Software Developer", "Consultant Senior", "Consultant", "Business Analyst Senior", "Business Analyst", "Support Consultant Senior", "Project Manager Senior" | Role-based billing rates |
| 37 | amount_425 | Decimal | Monetary amount | 425, 850, 2 337,50, 1700, 106,25 | Uses comma for decimal, space for thousands |
| 40 | MBillable | String (Enum) | Billable status flag | "F", "T" | F=False/Not billable, T=True/Billable |
| 41 | MBillableType | String (Enum) | Billing type classification | "CAPEX", "NonBill", "CFD", "PS", "IFRS" | 5 distinct values |
| 44 | MTYPE2 | String (Enum) | Secondary type classification | "CAPEX", "nonbill", "Bill" | Similar to MTYPE |
| 45 | EG - Hours to be billed | Decimal | Hours designated for billing | 0,50, 1, empty | Optional field, comma decimal |
| 47 | MEGhtb_dec | Decimal | Hours to be billed (decimal) | 12, 24, empty | Optional field |
| 54 | EG - Task Delivery Fixed Price Amount | Decimal | Fixed price amount | empty | Mostly empty in sample |

---

## 5. Department & Organization

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 16 | Department | String | Department code and name | "00316 EG Utility - DevOps", "00314 EG Utility - Professiona", "00315 EG Utility - Customer Su" | Format: {5-digit code} {name} |
| 42 | MManager | String | Manager username/code | "tomni", "Not", "hensk", "axsun", "risfj", "radan" | Short username codes |
| 43 | Mteam | String (Enum) | Team assignment | "Billing", "Not", "SCM", "Classic", "PM", "Sup", "Sweden", "Polaris", "EG", "PS" | 10+ distinct teams |
| 48 | Subsidiary | String (Enum) | Company subsidiary | "EGDK", "EGSU" | EGDK appears most common |
| 49 | Location | String | Location/office | empty | Mostly empty |
| 50 | Billing Subsidiary | String (Enum) | Subsidiary handling billing | "EGDK", "EGSU", empty | |
| 52 | Supervisor | String | Supervisor username | "mihtr", "bbjor", "anaks", "ertom" | Short username codes |
| 53 | Subsidiary | String (Enum) | Duplicate subsidiary field | "EGDK" | Same as field 48 |

---

## 6. Activity & Task Classification

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 17 | EG - Activity Code | String (Enum) | Activity category | "Technical debt", "Administration", "New features and functionalities", "Professional services", "Internal company time", "Account Management", "Internal projects", "Maintenance", "Legal Requirements", "Customer support" | 10+ categories |
| 21 | EG - Default Revenue Category (Item) | String (Enum) | Revenue category | "Professional Services" | Appears constant in sample |
| 22 | Utilized | Boolean | Is time utilized/productive | true, false | |
| 23 | Task | String | Task name/description | "Jive Utility and Energy", "Administration: Administration", "Technical dept AX2009", "SCRUM SCRUM SCRUM" | Free text |
| 24 | Service Item | String | Billing service item | ".[Hours] Consultancy services - T&M" | Appears constant, T&M = Time & Materials |
| 26 | Productive | Boolean | Is productive time | true, false | |
| 31 | EG - Task Delivery | String | Task delivery context | empty, "SAS-9924 - ""HTF Kontaktformular på selvbetjeningsportalen""" | Often empty |
| 55 | Parent Task | String | Parent task reference | "Evida Jive", "General & Administration", "Internal company time", "Task Delivery SonWin", "Utility Proces arbejde", "Unite : Utveckling Zynergy (allmän)", "Administration" | Free text |
| 56 | EG - Fixed or Time-based Item? | String | Billing model | empty | Mostly empty |

---

## 7. Employee Information

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 25 | Internal ID | Integer | Internal record ID | 36896049, 36897042, 39821365 | 8-digit number |
| 27 | Employee | String | Employee username/code | "tosan", "raang_movedtoemployee", "chjac", "brfra", "adymo" | Short username |
| 51 | Full Name | String | Employee full name | "tosan Tommy Sandlykke", "brfra Brian G. Frandsen", "chjac Charlotte Jacobsen" | Format: {username} {First Last} |

---

## 8. Memo & Description Fields

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 28 | Memo | String (Text) | Task memo/description | "Dev - job PBS betalingsrekvisitioner(Medsend bilag/ Total PBS) can't start", "Utility Head Meetings & Junior Mentoring" | Free text, can be empty |
| 30 | EG - Internal Memo | String (Text) | Internal notes | "Gennemgang af opg. - afklaring D365+AX2009 + gennemg. opg. XEL-12636.", "planning", "Team Apollo daily scrum" | Free text, often empty |

---

## 9. Product & System Information

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 32 | EG - Main Product (Project Task Time Tracking) | String (Enum) | Main product line | "Xellent D365", "Xellent AX2009", "SonWin", "EG Zynergy", empty | 4 main products |
| 33 | EG - Main Product | String (Enum) | Main product (duplicate) | "Xellent D365", "Xellent AX2009", "SonWin", "EG Zynergy", empty | Same as field 32 |
| 34 | EG - Sub Product (Project Task Time Tracking) | String (Enum) | Sub-product/module | "Xellent D365", "Xellent D365 (Main)", "Xellent AX2009", "Xellent AX2009 (Main)", "SonWin (Main)", "SonWin Billing", "Grid", "EG Zynergy (Main)" | More granular than main product |

---

## 10. Integration & External References

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 35 | EG - External Issue Number | String | JIRA/external issue ID | "XEL-28990", "XEL-29825", "XEL-35095", "SAS-9924", "ZYN-36368", "CS1629535", empty | Various tracking systems |
| 39 | MisJira | String (Enum) | Issue tracking system | "JIRA", "NS" (NetSuite), "internal", "Bugs", "SNOW" (ServiceNow) | 5 systems observed |

---

## 11. Approval & Status

| # | Field Name | Data Type | Description | Example Values | Notes |
|---|------------|-----------|-------------|----------------|-------|
| 36 | Approval Status | String (Enum) | Time entry approval status | "Approved" | Appears constant in sample |
| 12 | SI | Boolean | Unknown flag | false | Always false in sample |
| 46 | Price Level | String (Enum) | Pricing tier | "Custom" | Appears constant |

---

## Complete Field List (Alphabetically Sorted)

| # | Field Name | Data Type | Description | Example Values |
|---|------------|-----------|-------------|----------------|
| 37 | amount_425 | Decimal | Monetary amount | 425, 850, 2 337,50, 1700, 106,25 |
| 36 | Approval Status | String (Enum) | Time entry approval status | "Approved" |
| 9 | Billable | Boolean | Is entry billable to customer | true, false |
| 15 | Billing Class | String (Enum) | Detailed billing classification | "Software Developer Senior", "Software Developer", "Consultant Senior" |
| 50 | Billing Subsidiary | String (Enum) | Subsidiary handling billing | "EGDK", "EGSU", empty |
| 3 | Customer:Project | String | Project code/identifier | "PROJ089083", "PROJ007929" |
| 20 | Date | Date | Entry date | "22.11.2024", "01.05.2025" |
| 16 | Department | String | Department code and name | "00316 EG Utility - DevOps", "00314 EG Utility - Professiona" |
| 18 | Duration | String (Time) | Duration in HH:MM format | "01:00", "05:30", "00:15" |
| 19 | dur_dec | Decimal | Duration in decimal hours | 1, 5,50, 0,25 |
| 29 | Dur_r | Decimal | Duration rounded/calculated | 1, 5,50, 0,30, 0,80 |
| 17 | EG - Activity Code | String (Enum) | Activity category | "Technical debt", "Administration", "New features and functionalities" |
| 21 | EG - Default Revenue Category (Item) | String (Enum) | Revenue category | "Professional Services" |
| 11 | EG - Eligible for Capitalization | Boolean | Can be capitalized as asset | true, false |
| 4 | EG - External Reference | String | Project task reference ID | "ProjectTask-00000004123836" |
| 35 | EG - External Issue Number | String | JIRA/external issue ID | "XEL-28990", "XEL-29825", "XEL-35095", "SAS-9924" |
| 56 | EG - Fixed or Time-based Item? | String | Billing model | empty |
| 45 | EG - Hours to be billed | Decimal | Hours designated for billing | 0,50, 1, empty |
| 30 | EG - Internal Memo | String (Text) | Internal notes | "Gennemgang af opg. - afklaring D365+AX2009 + gennemg. opg. XEL-12636." |
| 33 | EG - Main Product | String (Enum) | Main product (duplicate) | "Xellent D365", "Xellent AX2009", "SonWin", "EG Zynergy" |
| 32 | EG - Main Product (Project Task Time Tracking) | String (Enum) | Main product line | "Xellent D365", "Xellent AX2009", "SonWin", "EG Zynergy" |
| 34 | EG - Sub Product (Project Task Time Tracking) | String (Enum) | Sub-product/module | "Xellent D365 (Main)", "Xellent AX2009 (Main)", "SonWin (Main)", "SonWin Billing" |
| 31 | EG - Task Delivery | String | Task delivery context | empty, "SAS-9924 - ""HTF Kontaktformular på selvbetjeningsportalen""" |
| 54 | EG - Task Delivery Fixed Price Amount | Decimal | Fixed price amount | empty |
| 10 | EG - To be IFRS adjusted | Boolean | IFRS accounting flag | true, false |
| 27 | Employee | String | Employee username/code | "tosan", "raang_movedtoemployee", "chjac", "brfra" |
| 51 | Full Name | String | Employee full name | "tosan Tommy Sandlykke", "brfra Brian G. Frandsen" |
| 25 | Internal ID | Integer | Internal record ID | 36896049, 36897042, 39821365 |
| 49 | Location | String | Location/office | empty |
| 40 | MBillable | String (Enum) | Billable status flag | "F", "T" |
| 41 | MBillableType | String (Enum) | Billing type classification | "CAPEX", "NonBill", "CFD", "PS", "IFRS" |
| 47 | MEGhtb_dec | Decimal | Hours to be billed (decimal) | 12, 24, empty |
| 39 | MisJira | String (Enum) | Issue tracking system | "JIRA", "NS" (NetSuite), "internal", "Bugs", "SNOW" (ServiceNow) |
| 1 | MKundenavn | String | Customer/Organization name | "Eg Danmark A/S ", "Aura A/S ", "Norlys Group A/S " |
| 42 | MManager | String | Manager username/code | "tomni", "Not", "hensk", "axsun", "risfj" |
| 43 | Mteam | String (Enum) | Team assignment | "Billing", "Not", "SCM", "Classic", "PM", "Sup" |
| 13 | MTYPE | String (Enum) | Main billing type | "CAPEX", "nonbill", "Bill", "IFRS" |
| 44 | MTYPE2 | String (Enum) | Secondary type classification | "CAPEX", "nonbill", "Bill" |
| 28 | Memo | String (Text) | Task memo/description | "Dev - job PBS betalingsrekvisitioner(Medsend bilag/ Total PBS) can't start" |
| 2 | Name | String | Full project name (Customer : Project) | "Eg Danmark A/S : Catch up - AX2009-->D365" |
| 14 | Non-billable | Boolean | Is non-billable | true, false |
| 55 | Parent Task | String | Parent task reference | "Evida Jive", "General & Administration", "Internal company time" |
| 46 | Price Level | String (Enum) | Pricing tier | "Custom" |
| 26 | Productive | Boolean | Is productive time | true, false |
| 6 | Project Name | String | Project short name | "Catch up - AX2009-->D365", "FAIN: EG Administration Project (India)" |
| 5 | Project Type | String (Enum) | Type/category of project | "Internal Product Project", "Customer Standard Project", "Internal Administration Project" |
| 24 | Service Item | String | Billing service item | ".[Hours] Consultancy services - T&M" |
| 12 | SI | Boolean | Unknown flag | false |
| 48 | Subsidiary | String (Enum) | Company subsidiary | "EGDK", "EGSU" |
| 53 | Subsidiary | String (Enum) | Duplicate subsidiary field | "EGDK" |
| 52 | Supervisor | String | Supervisor username | "mihtr", "bbjor", "anaks", "ertom" |
| 23 | Task | String | Task name/description | "Jive Utility and Energy", "Administration: Administration", "SCRUM SCRUM SCRUM" |
| 7 | Time Tracking | String | Composite time tracking entry | "22.11.2024 : tosan : 1:00" |
| 8 | Type | String (Enum) | Entry type | "Actual Time" |
| 22 | Utilized | Boolean | Is time utilized/productive | true, false |
| 38 | Week Of | Date | Week start date | "18.11.2024", "28.04.2025" |

---

## Data Type Summary

### Primitive Types:
- **String**: 36 fields (text, codes, names)
- **Boolean**: 8 fields (true/false flags)
- **Decimal**: 6 fields (hours, amounts - uses comma separator)
- **Integer**: 1 field (Internal ID)
- **Date**: 3 fields (DD.MM.YYYY format)
- **Time**: 1 field (HH:MM format)
- **Enum**: 1 field (constrained string values)

### Key Data Characteristics:
1. **Decimal separator**: Comma (,) not period
2. **Thousands separator**: Space character
3. **Date format**: DD.MM.YYYY (European)
4. **Time format**: HH:MM with leading zeros
5. **Empty values**: Represented as empty strings, not NULL
6. **Boolean representation**: Literal `true` and `false` (not 1/0)
7. **Username format**: Short lowercase codes (4-5 chars)

### Field Categories by Usage:
- **Identifiers**: 7 fields (IDs, codes, references)
- **Temporal**: 3 fields (dates, week)
- **Financial**: 8 fields (amounts, billing flags)
- **Organizational**: 9 fields (departments, teams, subsidiaries)
- **Descriptive**: 8 fields (memos, task descriptions)
- **Categorical**: 15 fields (enums, classifications)
- **Flags**: 8 fields (boolean indicators)
- **Empty/Unused**: 6 fields (mostly empty in dataset)

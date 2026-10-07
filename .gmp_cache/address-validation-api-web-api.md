---
name: address-validation-api-web-api
description: Use this skill when developing an application that needs to verify the deliverability and accuracy of a postal address, standardize input addresses, obtain precise geolocation, or retrieve postal-specific metadata like CASS certification and delivery point details.
license: Apache-2.0
metadata:
  version: 1.0.57
---

> [!IMPORTANT]
>
> **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

Use the Address Validation API to standardize, clean, and verify address
information for delivery purposes. This web API takes an input address and
returns a validated, formatted version, along with detailed metadata including
precise latitude/longitude coordinates, a Google Place ID, and, for US
addresses, comprehensive USPS (United States Postal Service) CASS data. The
service provides crucial insights such as address component corrections, missing
apartment numbers, and classification (residence, business, or PO Box).

### Mandatory settings

For the Address Validation API, the usage attribution ID
(`gmp_git_agentskills_v1`) MUST be provided via an HTTP header in all REST
requests. This is mandatory for solution tracking and compliance.

#### HTTP Header

```http
X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1
```

## 🚀 Master Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### 📦 Phase 1: Core Initialization & Base Setup (Primary)

-   [ ] **Step 1.1: Core functionality: Validates and standardizes a given
    address string, correcting typos and formatting based on known postal
    data.** Read
    [references/return-validated-address-for-specified-address-partial-address.md](https://www.gstatic.com/googlemapsplatform-agent-skills/address-validation-api-web-api/references/return-validated-address-for-specified-address-partial-address.md).
    *Trigger Condition*: User provides a full or partial address string and
    requests verification or standardization. *Evidence Checkpoint*: The API
    returns an HTTP 200 OK status containing the standardized address components
    and the `validation_granularity` field.

### 📦 Phase 2: Feature Layer & Custom Enrichment (Supplemental)

#### 🗺️ Feature Module: Address validation (Optional - Use-Case Dependent)

-   [ ] **Retrieves the precise geographic coordinates (latitude and longitude)
    for the validated address.** Read
    [references/return-the-latitude-longitude-coordinates-for-validated-address.md](https://www.gstatic.com/googlemapsplatform-agent-skills/address-validation-api-web-api/references/return-the-latitude-longitude-coordinates-for-validated-address.md).
    *Dependencies*:
    `["references/return-validated-address-for-specified-address-partial-address.md"]`
    *Trigger Condition*: User requires the location data (geocoding) for a
    validated address to display it on a map or calculate proximity. *Evidence
    Checkpoint*: The response includes the `location` field within the validated
    address result, containing valid `latitude` and `longitude` values.
-   [ ] **Retrieves the unique Google Place ID associated with the validated
    address, allowing integration with other Google services.** Read
    [references/return-the-google-place-identifier-for-validated-address.md](https://www.gstatic.com/googlemapsplatform-agent-skills/address-validation-api-web-api/references/return-the-google-place-identifier-for-validated-address.md).
    *Dependencies*:
    `["references/return-validated-address-for-specified-address-partial-address.md"]`
    *Trigger Condition*: User intends to link the address validation result to
    data stored in the Places API or other Google services. *Evidence
    Checkpoint*: The response includes the `place_id` field for the validated
    address structure.
-   [ ] **Applies U.S. Postal Service CASS certification rules for ensuring
    high-accuracy postal delivery validation for US addresses.** Read
    [references/use-united-states-postal-service-usps-coding-accuracy-support-system.md](https://www.gstatic.com/googlemapsplatform-agent-skills/address-validation-api-web-api/references/use-united-states-postal-service-usps-coding-accuracy-support-system.md).
    *Dependencies*:
    `["references/return-validated-address-for-specified-address-partial-address.md"]`
    *Trigger Condition*: User specifically requests CASS validation or requires
    maximum address accuracy for USPS mailings or logistics planning. *Evidence
    Checkpoint*: The response structure confirms CASS compliance and includes
    the relevant USPS-specific metadata required for CASS processing.
-   [ ] **Identifies the type of premises associated with the validated address
    (Business, Residence, or PO Box).** Read
    [references/return-information-about-whether-validated-address-business-residence-box.md](https://www.gstatic.com/googlemapsplatform-agent-skills/address-validation-api-web-api/references/return-information-about-whether-validated-address-business-residence-box.md).
    *Dependencies*:
    `["references/return-validated-address-for-specified-address-partial-address.md"]`
    *Trigger Condition*: User needs to distinguish between commercial and
    residential addresses, typically for differentiating shipping or service
    costs. *Evidence Checkpoint*: The response includes indicators or flags
    specifying the structure type of the address (e.g., residential or
    commercial classification).
-   [ ] **Provides detailed USPS delivery metadata, such as Carrier Route and
    delivery point validation codes, for US addresses.** Read
    [references/return-united-states-postal-service-usps-delivery-metadata-for-validated.md](https://www.gstatic.com/googlemapsplatform-agent-skills/address-validation-api-web-api/references/return-united-states-postal-service-usps-delivery-metadata-for-validated.md).
    *Dependencies*:
    `["references/return-validated-address-for-specified-address-partial-address.md"]`
    *Trigger Condition*: User requires in-depth USPS delivery logistics
    information to optimize sorting or bulk mail processes. *Evidence
    Checkpoint*: The response contains detailed USPS delivery fields, such as
    `delivery_point_barcode` or `carrier_route` metadata.
-   [ ] **Converts and returns a validated address in a standardized
    English-language format, regardless of the original input language.** Read
    [references/return-english-language-version-validated-address.md](https://www.gstatic.com/googlemapsplatform-agent-skills/address-validation-api-web-api/references/return-english-language-version-validated-address.md).
    *Dependencies*:
    `["references/return-validated-address-for-specified-address-partial-address.md"]`
    *Trigger Condition*: User needs a standardized, non-localized English
    representation of an address, particularly for international inputs.
    *Evidence Checkpoint*: The validated address output format uses standard
    English language representation for components and delimiters.
-   [ ] **Retrieves the Plus Code (Open Location Code) for the validated
    address, providing a simplified geocode/location identifier.** Read
    [references/return-the-plus-code-for-validated-address.md](https://www.gstatic.com/googlemapsplatform-agent-skills/address-validation-api-web-api/references/return-the-plus-code-for-validated-address.md).
    *Dependencies*:
    `["references/return-validated-address-for-specified-address-partial-address.md"]`
    *Trigger Condition*: User requires an alternative, simple location
    identifier that works well in areas without formal street addressing.
    *Evidence Checkpoint*: The response includes the `plus_code` field for the
    validated location.

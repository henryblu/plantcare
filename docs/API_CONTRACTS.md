# API Contracts — Smart Plant MVP

## PlantNet Identification API
- **Endpoint**: _TBD_
- **Request**: multipart photo upload + metadata.
- **Response**: candidate species list with confidence scores.
- **Notes**: Include mock contract for offline demos.

## ChatGPT Policy Generation API
- **Endpoint**: OpenAI Chat Completions (text-only prompt).
- **Request**: species details + type metadata.
- **Response**: Strict JSON `SpeciesProfile` payload conforming to shared schema.
- **Notes**: Document retry/validation expectations.

> _Fill in exact payload examples once integrations are implemented._

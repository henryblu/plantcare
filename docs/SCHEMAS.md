# JSON Schemas — Smart Plant MVP

## MoisturePolicy
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MoisturePolicy",
  "type": "object",
  "required": [
    "waterIntervalDays",
    "soilMoistureThreshold",
    "humidityPreference",
    "lightRequirement",
    "notes"
  ],
  "properties": {
    "waterIntervalDays": {
      "type": "integer",
      "minimum": 0,
      "maximum": 60,
      "description": "Recommended days between thorough waterings."
    },
    "soilMoistureThreshold": {
      "type": "integer",
      "minimum": 0,
      "maximum": 60,
      "description": "Soil moisture percentage that should trigger watering."
    },
    "humidityPreference": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    },
    "lightRequirement": {
      "type": "string",
      "enum": ["low", "medium", "bright-indirect", "full-sun"]
    },
    "notes": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 160
      },
      "maxItems": 2
    }
  },
  "additionalProperties": false
}
```

## SpeciesProfile
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SpeciesProfile",
  "type": "object",
  "required": [
    "speciesKey",
    "canonicalName",
    "type",
    "moisturePolicy",
    "source",
    "updatedAt"
  ],
  "properties": {
    "speciesKey": {
      "type": "string",
      "minLength": 1,
      "description": "Stable cache key (taxonId or canonical slug)."
    },
    "canonicalName": {
      "type": "string",
      "minLength": 1
    },
    "commonName": {
      "type": "string",
      "minLength": 1
    },
    "type": {
      "type": "string",
      "enum": ["succulent", "semi-succulent", "tropical", "fern", "other"]
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "moisturePolicy": {
      "$ref": "#/definitions/MoisturePolicy"
    },
    "source": {
      "type": "string",
      "enum": ["chatgpt", "seed", "cache", "manual"]
    },
    "ttlDays": {
      "type": "integer",
      "minimum": 1,
      "description": "Number of days the cached entry remains fresh."
    },
    "refreshedAt": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp when the cached entry was last refreshed."
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "additionalProperties": false,
  "definitions": {
    "MoisturePolicy": {
      "type": "object",
      "required": [
        "waterIntervalDays",
        "soilMoistureThreshold",
        "humidityPreference",
        "lightRequirement",
        "notes"
      ],
      "properties": {
        "waterIntervalDays": {
          "type": "integer",
          "minimum": 0,
          "maximum": 60
        },
        "soilMoistureThreshold": {
          "type": "integer",
          "minimum": 0,
          "maximum": 60
        },
        "humidityPreference": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "lightRequirement": {
          "type": "string",
          "enum": ["low", "medium", "bright-indirect", "full-sun"]
        },
        "notes": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          },
          "maxItems": 2
        }
      },
      "additionalProperties": false
    }
  }
}
```

### Example cached payload

```json
{
  "speciesKey": "ficus-elastica",
  "canonicalName": "Ficus elastica",
  "commonName": "Rubber plant",
  "type": "tropical",
  "confidence": 0.84,
  "moisturePolicy": {
    "waterIntervalDays": 7,
    "soilMoistureThreshold": 30,
    "humidityPreference": "medium",
    "lightRequirement": "bright-indirect",
    "notes": ["Let the top inch of soil dry before watering."]
  },
  "source": "chatgpt",
  "ttlDays": 180,
  "refreshedAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## Plant
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Plant",
  "type": "object",
  "required": [
    "id",
    "speciesKey",
    "createdAt",
    "updatedAt"
  ],
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1
    },
    "speciesKey": {
      "type": "string",
      "minLength": 1
    },
    "nickname": {
      "type": "string",
      "minLength": 1
    },
    "location": {
      "type": "string",
      "minLength": 1
    },
    "photoUri": {
      "type": "string",
      "minLength": 1
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "lastWateredAt": {
      "type": "string",
      "format": "date-time"
    },
    "notes": {
      "type": "string",
      "maxLength": 160
    },
    "moisturePolicyOverride": {
      "$ref": "#/definitions/MoisturePolicy"
    },
    "speciesProfile": {
      "$ref": "#/definitions/SpeciesProfile"
    }
  },
  "additionalProperties": false,
  "definitions": {
    "MoisturePolicy": {
      "type": "object",
      "required": [
        "waterIntervalDays",
        "soilMoistureThreshold",
        "humidityPreference",
        "lightRequirement",
        "notes"
      ],
      "properties": {
        "waterIntervalDays": {
          "type": "integer",
          "minimum": 0,
          "maximum": 60
        },
        "soilMoistureThreshold": {
          "type": "integer",
          "minimum": 0,
          "maximum": 60
        },
        "humidityPreference": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "lightRequirement": {
          "type": "string",
          "enum": ["low", "medium", "bright-indirect", "full-sun"]
        },
        "notes": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          },
          "maxItems": 2
        }
      },
      "additionalProperties": false
    },
    "SpeciesProfile": {
      "type": "object",
      "required": [
        "speciesKey",
        "canonicalName",
        "type",
        "moisturePolicy",
        "source",
        "updatedAt"
      ],
      "properties": {
        "speciesKey": {
          "type": "string",
          "minLength": 1
        },
        "canonicalName": {
          "type": "string",
          "minLength": 1
        },
        "commonName": {
          "type": "string",
          "minLength": 1
        },
        "type": {
          "type": "string",
          "enum": ["succulent", "semi-succulent", "tropical", "fern", "other"]
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "moisturePolicy": {
          "$ref": "#/definitions/MoisturePolicy"
        },
        "source": {
          "type": "string",
          "enum": ["chatgpt", "seed", "cache", "manual"]
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time"
        },
        "createdAt": {
          "type": "string",
          "format": "date-time"
        }
      },
      "additionalProperties": false
    }
  }
}
```
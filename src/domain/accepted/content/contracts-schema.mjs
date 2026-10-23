// Pinned accepted contract; no remote schema resolution.
export default {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:romdex:npcdex:contracts:1",
  "title": "NPCDex content contracts — U20A with additive U20I catalog/view records",
  "description": "Structural contract only. Cross-document authorization, integrity, graph and domain validation are mandatory; see README.",
  "oneOf": [
    {
      "$ref": "#/$defs/record"
    },
    {
      "$ref": "#/$defs/mapping"
    },
    {
      "$ref": "#/$defs/plan"
    },
    {
      "$ref": "#/$defs/review"
    },
    {
      "$ref": "#/$defs/package"
    },
    {
      "$ref": "#/$defs/result"
    },
    {
      "$ref": "#/$defs/correction"
    },
    {
      "$ref": "#/$defs/binding"
    },
    {
      "$ref": "#/$defs/publication"
    },
    {
      "$ref": "#/$defs/view"
    },
    {
      "$ref": "#/$defs/catalog"
    }
  ],
  "$defs": {
    "ref": {
      "type": "object",
      "properties": {
        "recordId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "revisionId": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "recordId",
        "revisionId"
      ],
      "additionalProperties": false
    },
    "target": {
      "type": "object",
      "properties": {
        "recordId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "pointId": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "blockIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "promptKey": {
          "anyOf": [
            {
              "type": "string",
              "minLength": 1
            },
            {
              "type": "null"
            }
          ]
        },
        "gender": {
          "enum": [
            null,
            "both",
            "male",
            "female"
          ]
        }
      },
      "required": [
        "recordId",
        "pointId",
        "blockIds",
        "promptKey",
        "gender"
      ],
      "additionalProperties": false
    },
    "state": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "exists": {
              "const": false
            }
          },
          "required": [
            "exists"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "exists": {
              "const": true
            },
            "value": {}
          },
          "required": [
            "exists",
            "value"
          ],
          "additionalProperties": false
        }
      ]
    },
    "patch": {
      "type": "object",
      "properties": {
        "recordId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "path": {
          "type": "string",
          "pattern": "^/(payload|lifecycle)(/[^/]+)*$"
        },
        "before": {
          "$ref": "#/$defs/state"
        },
        "after": {
          "type": "object",
          "properties": {
            "exists": {
              "const": true
            },
            "value": {}
          },
          "required": [
            "exists",
            "value"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "recordId",
        "path",
        "before",
        "after"
      ],
      "additionalProperties": false
    },
    "legacyRef": {
      "type": "object",
      "properties": {
        "townId": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "enum": [
            "town",
            "location",
            "area",
            "character",
            "element",
            "point",
            "block",
            "prompt",
            "annotation",
            "plan",
            "history",
            "source"
          ]
        },
        "id": {
          "type": "string",
          "minLength": 1
        },
        "reviewKey": {
          "anyOf": [
            {
              "type": "string",
              "minLength": 1
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "townId",
        "kind",
        "id",
        "reviewKey"
      ],
      "additionalProperties": false
    },
    "source": {
      "type": "object",
      "properties": {
        "repositoryId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "revision": {
          "type": "string",
          "minLength": 1
        },
        "artifactSha256": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "verification": {
          "enum": [
            "illustrative",
            "documented",
            "rom-verified"
          ]
        }
      },
      "required": [
        "repositoryId",
        "revision",
        "artifactSha256",
        "verification"
      ],
      "additionalProperties": false
    },
    "evidence": {
      "type": "object",
      "properties": {
        "label": {
          "type": "string",
          "minLength": 1
        },
        "sourceId": {
          "type": "string",
          "minLength": 1
        },
        "excerpt": {
          "type": "string"
        },
        "locator": {
          "anyOf": [
            {
              "type": "string",
              "minLength": 1
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "sourceId",
        "excerpt",
        "locator"
      ],
      "additionalProperties": false
    },
    "block": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "kind": {
          "enum": [
            "dialogue",
            "note"
          ]
        },
        "text": {
          "type": "string"
        },
        "speaker": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "gender": {
          "enum": [
            "both",
            "male",
            "female"
          ]
        },
        "reviewKey": {
          "anyOf": [
            {
              "type": "string",
              "minLength": 1
            },
            {
              "type": "null"
            }
          ]
        },
        "sourceBlockId": {
          "anyOf": [
            {
              "type": "string",
              "minLength": 1
            },
            {
              "type": "null"
            }
          ]
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "rawMessageData": {},
        "legacyData": {
          "type": "object"
        },
        "archived": {
          "type": "boolean"
        }
      },
      "required": [
        "id",
        "kind",
        "text",
        "speaker",
        "gender",
        "reviewKey",
        "sourceBlockId",
        "sourceIds",
        "rawMessageData",
        "legacyData",
        "archived"
      ],
      "additionalProperties": false
    },
    "point": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "condition": {
          "type": "string"
        },
        "stageIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "participantIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "evidence": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/evidence"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "blocks": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/$defs/block"
          }
        },
        "blockOrder": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "legacyData": {
          "type": "object"
        }
      },
      "required": [
        "id",
        "condition",
        "stageIds",
        "sourceIds",
        "participantIds",
        "evidence",
        "blocks",
        "blockOrder",
        "legacyData"
      ],
      "additionalProperties": false
    },
    "payloadRegion": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "regionKey": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "name",
        "regionKey"
      ],
      "additionalProperties": false
    },
    "payloadMap": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "regionId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "sourceMapKeys": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "subzoneIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "timelineRef": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        }
      },
      "required": [
        "name",
        "regionId",
        "sourceMapKeys",
        "subzoneIds",
        "timelineRef"
      ],
      "additionalProperties": false
    },
    "payloadSubzone": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "mapId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "sourceAreaKeys": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "appearanceIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "sceneIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "interactiveIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "aliasRefs": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0,
          "uniqueItems": true
        }
      },
      "required": [
        "name",
        "mapId",
        "sourceAreaKeys",
        "appearanceIds",
        "sceneIds",
        "interactiveIds",
        "aliasRefs"
      ],
      "additionalProperties": false
    },
    "payloadProfile": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "baseImageId": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "identityEvidence": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/evidence"
          },
          "minItems": 0,
          "uniqueItems": true
        }
      },
      "required": [
        "name",
        "baseImageId",
        "identityEvidence"
      ],
      "additionalProperties": false
    },
    "payloadAppearance": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "profileId": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "profileByPlayerGender": {
          "type": "object",
          "properties": {
            "male": {
              "anyOf": [
                {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
                },
                {
                  "type": "null"
                }
              ]
            },
            "female": {
              "anyOf": [
                {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "male",
            "female"
          ],
          "additionalProperties": false
        },
        "sourceAreaKeys": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "sourceElementIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "points": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/$defs/point"
          }
        },
        "pointOrder": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "sceneIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "overrides": {
          "type": "object",
          "properties": {
            "displayName": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "imageAssetId": {
              "anyOf": [
                {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "displayName",
            "imageAssetId"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "name",
        "profileId",
        "profileByPlayerGender",
        "sourceAreaKeys",
        "sourceElementIds",
        "points",
        "pointOrder",
        "sceneIds",
        "overrides"
      ],
      "additionalProperties": false
    },
    "payloadScene": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "participantIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "points": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/$defs/point"
          }
        },
        "pointOrder": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        }
      },
      "required": [
        "name",
        "participantIds",
        "points",
        "pointOrder"
      ],
      "additionalProperties": false
    },
    "payloadInteractive": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "points": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/$defs/point"
          }
        },
        "pointOrder": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        }
      },
      "required": [
        "name",
        "points",
        "pointOrder"
      ],
      "additionalProperties": false
    },
    "payloadShared": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "sharedType": {
          "enum": [
            "progression",
            "global-dialogue",
            "assets"
          ]
        },
        "definitions": {
          "type": "object"
        }
      },
      "required": [
        "name",
        "sharedType",
        "definitions"
      ],
      "additionalProperties": false
    },
    "record": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexContentRevision/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "recordId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "kind": {
          "enum": [
            "region",
            "map",
            "subzone",
            "profile",
            "appearance",
            "scene",
            "interactive",
            "shared"
          ]
        },
        "parentRecordId": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "parents": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "current": {
          "type": "object",
          "properties": {
            "lifecycle": {
              "enum": [
                "planned",
                "active",
                "archived"
              ]
            },
            "payload": {
              "type": "object"
            }
          },
          "required": [
            "lifecycle",
            "payload"
          ],
          "additionalProperties": false
        },
        "mappingRefs": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "legacyRefs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/legacyRef"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "legacyData": {
          "type": "object"
        },
        "revisionId": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "recordId",
        "kind",
        "parentRecordId",
        "parents",
        "current",
        "mappingRefs",
        "legacyRefs",
        "legacyData",
        "revisionId"
      ],
      "additionalProperties": false,
      "allOf": [
        {
          "if": {
            "properties": {
              "kind": {
                "const": "region"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "properties": {
              "current": {
                "properties": {
                  "payload": {
                    "$ref": "#/$defs/payloadRegion"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "kind": {
                "const": "map"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "properties": {
              "current": {
                "properties": {
                  "payload": {
                    "$ref": "#/$defs/payloadMap"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "kind": {
                "const": "subzone"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "properties": {
              "current": {
                "properties": {
                  "payload": {
                    "$ref": "#/$defs/payloadSubzone"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "kind": {
                "const": "profile"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "properties": {
              "current": {
                "properties": {
                  "payload": {
                    "$ref": "#/$defs/payloadProfile"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "kind": {
                "const": "appearance"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "properties": {
              "current": {
                "properties": {
                  "payload": {
                    "$ref": "#/$defs/payloadAppearance"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "kind": {
                "const": "scene"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "properties": {
              "current": {
                "properties": {
                  "payload": {
                    "$ref": "#/$defs/payloadScene"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "kind": {
                "const": "interactive"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "properties": {
              "current": {
                "properties": {
                  "payload": {
                    "$ref": "#/$defs/payloadInteractive"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "kind": {
                "const": "shared"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "properties": {
              "current": {
                "properties": {
                  "payload": {
                    "$ref": "#/$defs/payloadShared"
                  }
                }
              }
            }
          }
        }
      ]
    },
    "mapping": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexROMMapping/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "mappingId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "recordId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "source": {
          "$ref": "#/$defs/source"
        },
        "status": {
          "enum": [
            "unresolved",
            "documented",
            "rom-verified"
          ]
        },
        "locators": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "kind": {
                "enum": [
                  "map",
                  "event",
                  "script",
                  "message",
                  "asset",
                  "source-document"
                ]
              },
              "adapter": {
                "type": "string",
                "minLength": 1
              },
              "path": {
                "type": "string",
                "minLength": 1
              },
              "fileSha256": {
                "anyOf": [
                  {
                    "type": "string",
                    "pattern": "^[a-f0-9]{64}$"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "selectors": {
                "type": "object",
                "additionalProperties": {
                  "anyOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    }
                  ]
                }
              }
            },
            "required": [
              "kind",
              "adapter",
              "path",
              "fileSha256",
              "selectors"
            ],
            "additionalProperties": false
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "evidence": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/evidence"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "digest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "mappingId",
        "recordId",
        "source",
        "status",
        "locators",
        "evidence",
        "digest"
      ],
      "additionalProperties": false
    },
    "asset": {
      "type": "object",
      "properties": {
        "assetId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "sha256": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "bytes": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        },
        "mime": {
          "enum": [
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
            "application/octet-stream",
            "text/plain"
          ]
        },
        "delivery": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "kind": {
                  "const": "inline"
                },
                "base64": {
                  "type": "string"
                }
              },
              "required": [
                "kind",
                "base64"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "const": "youtrack"
                },
                "instanceKey": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
                },
                "projectId": {
                  "type": "string",
                  "minLength": 1
                },
                "issueId": {
                  "type": "string",
                  "minLength": 1
                },
                "attachmentId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "kind",
                "instanceKey",
                "projectId",
                "issueId",
                "attachmentId"
              ],
              "additionalProperties": false
            }
          ]
        }
      },
      "required": [
        "assetId",
        "sha256",
        "bytes",
        "mime",
        "delivery"
      ],
      "additionalProperties": false
    },
    "plan": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexPlanRevision/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "planId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "version": {
          "type": "integer",
          "minimum": 1,
          "maximum": 9007199254740991
        },
        "parents": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "target": {
          "$ref": "#/$defs/target"
        },
        "intent": {
          "enum": [
            "ADD",
            "UPDATE",
            "REMOVE",
            "FINAL"
          ]
        },
        "workflow": {
          "enum": [
            "draft",
            "ready",
            "final",
            "superseded",
            "implemented"
          ]
        },
        "instructions": {
          "type": "string"
        },
        "proposedDialogue": {
          "type": "string"
        },
        "baseline": {
          "$ref": "#/$defs/ref"
        },
        "readSet": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/ref"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "changes": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/patch"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "requiredAssetIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "reviewRefs": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "legacyRefs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/legacyRef"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "digest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "planId",
        "version",
        "parents",
        "target",
        "intent",
        "workflow",
        "instructions",
        "proposedDialogue",
        "baseline",
        "readSet",
        "changes",
        "requiredAssetIds",
        "reviewRefs",
        "legacyRefs",
        "digest"
      ],
      "additionalProperties": false
    },
    "review": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexReviewRevision/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "reviewId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "parents": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "target": {
          "$ref": "#/$defs/target"
        },
        "baseline": {
          "$ref": "#/$defs/ref"
        },
        "flag": {
          "enum": [
            "none",
            "standard",
            "critical"
          ]
        },
        "note": {
          "type": "string"
        },
        "testStatus": {
          "enum": [
            "unreviewed",
            "verified",
            "inaccessible"
          ]
        },
        "digest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "reviewId",
        "parents",
        "target",
        "baseline",
        "flag",
        "note",
        "testStatus",
        "digest"
      ],
      "additionalProperties": false
    },
    "group": {
      "type": "object",
      "properties": {
        "groupId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "itemIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "dependsOnGroups": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "recordIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "acceptanceChecks": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1,
          "uniqueItems": true
        }
      },
      "required": [
        "groupId",
        "itemIds",
        "dependsOnGroups",
        "recordIds",
        "acceptanceChecks"
      ],
      "additionalProperties": false
    },
    "package": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexMapPackage/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "packageId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "version": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        },
        "supersedes": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "mapId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "source": {
          "$ref": "#/$defs/source"
        },
        "recordSnapshots": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/record"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "mappings": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/mapping"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "plans": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/plan"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "observations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "review": {
                "$ref": "#/$defs/review"
              },
              "role": {
                "enum": [
                  "observation",
                  "question"
                ]
              }
            },
            "required": [
              "review",
              "role"
            ],
            "additionalProperties": false
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "assets": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/asset"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "groups": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/group"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "instructions": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "digest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "packageId",
        "version",
        "supersedes",
        "mapId",
        "source",
        "recordSnapshots",
        "mappings",
        "plans",
        "observations",
        "assets",
        "groups",
        "instructions",
        "digest"
      ],
      "additionalProperties": false
    },
    "result": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexImplementationResult/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "resultId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "packageDigest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "groupId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "itemIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "readSet": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/ref"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "recordUpdates": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "before": {
                "$ref": "#/$defs/ref"
              },
              "after": {
                "$ref": "#/$defs/record"
              }
            },
            "required": [
              "before",
              "after"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "resolvedReviewDigests": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "rom": {
          "type": "object",
          "properties": {
            "repositoryId": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
            },
            "beforeRevision": {
              "type": "string",
              "minLength": 1
            },
            "afterRevision": {
              "type": "string",
              "minLength": 1
            },
            "beforeSha256": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "afterSha256": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "verification": {
              "enum": [
                "illustrative",
                "agent-reported"
              ]
            }
          },
          "required": [
            "repositoryId",
            "beforeRevision",
            "afterRevision",
            "beforeSha256",
            "afterSha256",
            "verification"
          ],
          "additionalProperties": false
        },
        "checks": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "digest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "resultId",
        "packageDigest",
        "groupId",
        "itemIds",
        "readSet",
        "recordUpdates",
        "resolvedReviewDigests",
        "rom",
        "checks",
        "digest"
      ],
      "additionalProperties": false
    },
    "correction": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexDocumentationCorrection/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "correctionId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "reason": {
          "type": "string",
          "minLength": 1
        },
        "evidence": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/evidence"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "readSet": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/ref"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "recordUpdates": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "before": {
                "$ref": "#/$defs/ref"
              },
              "after": {
                "$ref": "#/$defs/record"
              }
            },
            "required": [
              "before",
              "after"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "romChangeRequested": {
          "const": false
        },
        "digest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "correctionId",
        "reason",
        "evidence",
        "readSet",
        "recordUpdates",
        "romChangeRequested",
        "digest"
      ],
      "additionalProperties": false
    },
    "binding": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexTaskBinding/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "bindingId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "packageDigest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "instanceKey": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "projectId": {
          "type": "string",
          "minLength": 1
        },
        "issueId": {
          "type": "string",
          "minLength": 1
        },
        "attachmentId": {
          "type": "string",
          "minLength": 1
        },
        "verifiedAttachmentSha256": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "createdTask": {
          "type": "boolean"
        },
        "dispatch": {
          "const": "none"
        },
        "digest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "bindingId",
        "packageDigest",
        "instanceKey",
        "projectId",
        "issueId",
        "attachmentId",
        "verifiedAttachmentSha256",
        "createdTask",
        "dispatch",
        "digest"
      ],
      "additionalProperties": false
    },
    "publication": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexPublication/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "publicationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "kind": {
          "enum": [
            "bootstrap",
            "planning",
            "correction",
            "implementation",
            "verification",
            "resolution",
            "catalog"
          ]
        },
        "parentPublications": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "artifactDigests": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "baseRevisions": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/ref"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "resultDigest": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "groupId": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "digest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "publicationId",
        "kind",
        "parentPublications",
        "artifactDigests",
        "baseRevisions",
        "resultDigest",
        "groupId",
        "digest"
      ],
      "additionalProperties": false
    },
    "view": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexViewRevision/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "viewId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "recordId": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "parents": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "source": {
          "type": "object",
          "properties": {
            "sha256": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "recordRevision": {
              "anyOf": [
                {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "sha256",
            "recordRevision"
          ],
          "additionalProperties": false
        },
        "payload": {
          "type": "object"
        },
        "digest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "viewId",
        "recordId",
        "parents",
        "source",
        "payload",
        "digest"
      ],
      "additionalProperties": false
    },
    "catalog": {
      "type": "object",
      "properties": {
        "schema": {
          "const": "NPCDexCatalogRevision/1"
        },
        "workspaceId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "operationId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "createdAt": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
        },
        "actorClaim": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "catalogId": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
        },
        "mode": {
          "enum": [
            "presentation-transition",
            "content-import"
          ]
        },
        "source": {
          "type": "object",
          "properties": {
            "repositoryId": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
            },
            "revision": {
              "type": "string",
              "minLength": 1
            },
            "artifactSha256": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "verification": {
              "enum": [
                "documented",
                "verified"
              ]
            }
          },
          "required": [
            "repositoryId",
            "revision",
            "artifactSha256",
            "verification"
          ],
          "additionalProperties": false
        },
        "reason": {
          "type": "string",
          "minLength": 1
        },
        "recordChanges": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "recordId": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9:._-]{0,159}$"
              },
              "beforeRevision": {
                "anyOf": [
                  {
                    "type": "string",
                    "pattern": "^[a-f0-9]{64}$"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "afterRevision": {
                "type": "string",
                "pattern": "^[a-f0-9]{64}$"
              }
            },
            "required": [
              "recordId",
              "beforeRevision",
              "afterRevision"
            ],
            "additionalProperties": false
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "viewDigests": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "mappingDigests": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "romChangeRequested": {
          "const": false
        },
        "digest": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "schema",
        "workspaceId",
        "operationId",
        "createdAt",
        "actorClaim",
        "catalogId",
        "mode",
        "source",
        "reason",
        "recordChanges",
        "viewDigests",
        "mappingDigests",
        "romChangeRequested",
        "digest"
      ],
      "additionalProperties": false
    }
  }
};

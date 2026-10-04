# TimesFM research workspace mirror reference

FinanceXAI uses the following repository as the historical product/reference source requested by the project owner:

- Repository: https://github.com/SE-66/SE-66-timesfm-research-workspace
- TimesFM reference commit: `17dc87aaee41d96d214269b65e6fd211d4b636ee`
- Later replacement commit: `e9ddf5073ded3fb05282da7479ac5ba2e96cb3e3`

## Important boundary

The current `main` branch of that repository is a DevCloud control-plane project and no longer contains the TimesFM forecasting workspace.

The historical TimesFM commit did not bundle or execute TimesFM locally. It embedded an external Hugging Face Space and explicitly treated model execution as an external boundary.

FinanceXAI therefore does **not** blindly copy the current repository head. It uses the historical snapshot as provenance/reference and implements its own Cloudflare-native TimesFM adapter around the official Google TimesFM 3 package and model.

## Model

- Package: `timesfm[torch]==3.0.2`
- Checkpoint: `google/timesfm-3.0-pytorch`
- Runtime: Cloudflare Container, CPU
- Model license: `timesfm-non-commercial-license-v1.0`

The model-weight license is separate from the Apache-2.0 TimesFM source-code license. Do not represent this model path as commercially licensed.

# Glossary

Domain vocabulary for PoseWear. Implementation-free.

## Provider（服务商）

A service that turns a prompt and reference images into a generated image. PoseWear currently talks to OpenAI, Gemini, Seedream, and generic OpenAI-compatible relays from the browser. `sd.cpp` is a local provider: the generation engine runs on the user's own machine, not in PoseWear's cloud.

## Reference image（参考图）

An image selected from a PoseWear gallery (portrait, garment, pose, expression) or uploaded by the user, used to condition a generation request. Reference images are forwarded to the provider together with the prompt.

## Prompt（提示词）

The text describing the desired generated image. Composed from the selected reference items plus user input; may be rewritten by the "reduce false rejections" feature before being sent.

## Model file（模型文件）

A trained diffusion weight file. A complete generator may need several model files together (for example a diffusion model and a text encoder).

## Recipe（配方）

A named combination of model files and default generation settings. This is what a user selects when choosing which local model to generate with.

## Loaded model（已加载模型）

The model configuration currently held ready by a local generation server. Generation uses the loaded model; choosing a different recipe takes effect only after that recipe has been explicitly loaded.

## Generation（生图）

The act of sending a prompt and reference images to a provider and receiving one or more generated images. A single user action may produce multiple generations.

## Studio（试穿工作台）

The in-browser workspace where the user selects reference images, composes the prompt, triggers generation, and reviews results.

## Tray（组合托盘）

The gallery-side selection surface. Items placed in the tray can be pushed into the Studio and used as reference images for generation.

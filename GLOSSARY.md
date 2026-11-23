# Glossary

Domain vocabulary for PoseWear. Implementation-free.

## Provider（服务商）

A service that turns a prompt and reference images into a generated image. PoseWear currently talks to OpenAI, Gemini, Seedream, and generic OpenAI-compatible relays from the browser. `sd.cpp` is a local provider: the generation engine runs on the user's own machine, not in PoseWear's cloud.

## Reference image（参考图）

An image selected from a PoseWear gallery (portrait, garment, pose, expression) or uploaded by the user, used to condition a generation request. Reference images are forwarded to the provider together with the prompt.

## Reference-image generation request（参考图生图请求）

A generation request that carries one or more reference images together with a prompt to produce a new image. It is distinct from text-only generation and from editing an existing image.
_Avoid_: 带图分支, image editing request

## Text-only generation（纯提示词生图）

A generation request that carries a prompt and no reference images.
_Avoid_: prompt-only generation, 纯文字生图

## Prompt（提示词）

The text describing the desired generated image. Composed from the selected reference items plus user input; may be rewritten by the "reduce false rejections" feature before being sent.

## Model file（模型文件）

A trained diffusion weight file. A complete generator may need several model files together (for example a diffusion model and a text encoder).

## Recipe（配方）

A named combination of model files and default generation settings. This is what a user picks when choosing which local model to generate with; it becomes the model in effect only after it has been loaded.

## Loaded model（已加载模型）

The model configuration currently held ready by a local generation server. Generation uses the loaded model; choosing a different recipe takes effect only after that recipe has been explicitly loaded. The interface may only present a loaded model after the server has reported it in its model status.

## Pending recipe（待加载配方）

A recipe the user has picked in the settings but not yet loaded. It is not in effect: generation still uses the loaded model. A pending recipe is shown next to the loaded model, never as the loaded model, and it is dropped once the recipe is loaded or the load fails.

## Generation（生图）

The act of sending a prompt and reference images to a provider and receiving one or more generated images. A single user action may produce multiple generations.

## Studio（试穿工作台）

The in-browser workspace where the user selects reference images, composes the prompt, triggers generation, and reviews results.

## Tray（组合托盘）

The gallery-side selection surface. Items placed in the tray can be pushed into the Studio and used as reference images for generation.

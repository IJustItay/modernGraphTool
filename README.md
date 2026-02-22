# modernGraphTool_beta

A completely re-engineered graphtool, built with modern web technologies.

You can discover more at the [modernGraphTool documentation page][DOCS].

> *modernGraphTool_**beta** is still in the early stages of development. \
> Frequent breaking changes and design revisions may occur.*

## Demo

https://potatosalad775.github.io/modernGraphTool

Also available in Squiglink : https://silicagel.squig.link
## Custom Features & Credits

This fork of `modernGraphTool` includes several massive upgrades developed by **[IJustItay](https://github.com/IJustItay)**:
*   **AutoEQ WebAssembly Engine**: Integrated the `peqdb/autoeq-c` library directly into the modernGraphTool web worker for zero-latency, background thread filter calculations using WebAssembly.
*   **Native SquigLoader**: Deep integrated `dov-vai/SquigLoader` capabilities. Allows you to seamlessly fetch and import external reviewer targets (e.g. crinacle, kr0mka, Super* Review) natively into the FR parser.
*   **Mobile Device PEQ Connect**: Bypassed strict `navigator.hid` requirements to allow cross-platform browser support for the Device Connect plugin, enabling Network/Bluetooth PEQ pushing straight from mobile devices.

## Download

See [Release Page][RELEASE] for download options.

## Developer Guide

modernGraphTool is bundled with [Rollup.js][ROLLUP] for better performance.

To build modernGraphTool, you need to have Node.js installed. Then, run the following commands:

```bash
# Setup Dependencies
npm install

# Development (starts watchers + dev server)
npm run dev

# Build for production (./dist)
npm run build

# Preview production build
npm run preview
```

## Contributing
Contributions are always welcome, no matter how small or large!

Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License

modernGraphTool is open source software licensed under MIT License.

[CRINGRAPH]: https://github.com/mlochbaum/CrinGraph
[VSCODE]: https://code.visualstudio.com/
[VSCODE_LIVE_PREVIEW]: https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server
[ROLLUP]: https://rollupjs.org/
[SQUIGLINK_LAB]: https://github.com/squiglink/lab
[DOCS]: https://potatosalad775.github.io/modernGraphTool/docs
[RELEASE]: https://github.com/potatosalad775/modernGraphTool/releases

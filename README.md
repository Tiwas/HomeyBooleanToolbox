# Boolean Toolbox for Homey

![Boolean Toolbox Icon](no.tiwas.booleantoolbox/assets/icon.svg)

Create advanced, state-aware logic units for your Homey flows. Move beyond simple `AND`/`OR` cards and build powerful logic modules based on dynamic boolean expressions.

## About the Problem: "Flow Spaghetti"

Standard Homey Flows are powerful, but creating complex logic can quickly become messy. If you have multiple conditions to check, you often end up with a web of logic cards that is hard to read, maintain, and debug.

| Standard Homey Flow | With Boolean Toolbox |
| --- | --- |
| ![https://tiwas.github.io/HomeyBooleanToolbox/homey%20std.png)](https://tiwas.github.io/HomeyBooleanToolbox/homey%20std.png) | ![(https://tiwas.github.io/HomeyBooleanToolbox/logic%20unit.jpg)](https://tiwas.github.io/HomeyBooleanToolbox/logic%20unit.jpg) |
| *A complex web of logic cards.* | *A single Logic Unit provides a clean, controllable result.* |

Boolean Toolbox solves this by providing a virtual "Logic Unit" device. Instead of wiring together multiple cards, you define your entire logic in a single text-based expression. The device waits for all necessary input signals, evaluates the expression, and gives you a single, predictable `true` or `false` output.

## Features

- ✅ **Dynamic Logic with Expressions:** Define complex logic with a simple formula like `A * (B + C)`. You can change your logic in seconds without rebuilding your entire flow.
- ⚙️ **State-Aware:** The device automatically knows which inputs are needed based on your expression. It will wait until it has received a status from all required inputs before calculating a result.
- 🔄 **Clean & Controllable Outputs:** The unit provides distinct "Output becomes true" and "Output becomes false" triggers, giving you full control over both outcomes.
- 🐞 **Simple Debugging:** If there is a syntax error in your logic expression, the app will log an error to help you find the problem. It will not produce an output if the logic fails. (Note: The device simply waits if an input signal is missing; it does not produce an error in that case.)
- 🔗 **Deep Flow Integration:** Uses dedicated Flow cards for setting inputs and reacting to the output, making your flows cleaner and easier to read.
- 🧪 **Online Emulator:** Test your logic design before creating a device with the built-in emulator.

## Installation

This app is not currently in the official Homey App Store. You can install it manually.

### Method 1: Install from URL (Recommended)

1. Go to **Settings** &gt; **Apps** in your Homey app.
2. Click the **(+) Add app** button.
3. Click on **Custom URL**.
4. Enter the URL to the `app.json` file from this repository's latest release. For example:`https://raw.githubusercontent.com/YOUR_USERNAME/Boolean-Toolbox/main/no.tiwas.booleantoolbox/app.json`
5. Follow the on-screen instructions to install.

### Method 2: For Developers

If you have the Homey CLI installed, you can clone this repository and run the app locally.

`https://raw.githubusercontent.com/YOUR_USERNAME/Boolean-Toolbox/main/no.tiwas.booleantoolbox/app.json`

## How to Use

1. **Add a Device:** Add a new device in Homey and find **Boolean Toolbox**. Create a new "Logic Unit".
2. **Configure the Unit:** Go to the device's settings. You will find two main fields:

    - **Boolean Expression:** This is where you write your logic.

        - Use `A`, `B`, `C`, `D`, `E` for the five possible inputs.
        - Use `*` for `AND`.
        - Use `+` for `OR`.
        - Use `^` for `XOR` (exclusive OR).
        - Use `()` to group operations.
        - **Example:** To turn on an outdoor light (Q) only when it's dark (A) **AND** (motion is detected (B) **OR** a door is opened (C)), the expression would be: `A * (B + C)`.
    - **Invert final result (NOT):** Check this box if you want to flip the final result (true becomes false, and false becomes true).
3. **Use in Flows:**

    - **Action Cards:** Use the **"Set input [A-E] to true/false"** cards to send signals *to* your Logic Unit.
    - **Trigger Cards:** Use the **"Output becomes true/false"** cards to start a new flow when the logic has been evaluated.
    - **Condition Cards:** Use the **"Output is true"** card to check the current state within your existing flows.

## Logic Emulator

Don't want to create a device just to test an idea? You can use the online emulator to design and test your logic before implementing it in Homey.

[**Try the Emulator Here**](https://tiwas.github.io/HomeyBooleanToolbox/emulator.html "null")

## Project Structure

The source code for the Homey application itself is located within the `no.tiwas.booleantoolbox` directory.

```
.
├── no.tiwas.booleantoolbox/ <-- Main application source code
│ ├── app.json
│ ├── drivers/
│ ├── assets/
│ └── ...
├── emulator.html <-- The online logic emulator
└── README.md
```
## For Developers

This project is built with the Homey SDK v3. To get started with development:

1. Clone the repository.
2. Navigate into the app directory: `cd no.tiwas.booleantoolbox`
3. Install dependencies: `npm install`
4. Run the app in development mode: `homey app run --remote`

## Author

- **Lars Kvanum**

## License

This project is licensed under the MIT License - see the [LICENSE](https://www.google.com/search?q=LICENSE "null") file for details.
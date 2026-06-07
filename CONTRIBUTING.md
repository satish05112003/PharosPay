# Contributing to PharosPay

We welcome contributions from the community. Please follow these guidelines to ensure a smooth contribution process.

## Process

1. **Fork**: Fork the repository on GitHub.
2. **Branch**: Create a feature branch from the `main` branch (`git checkout -b feature/my-feature`).
3. **Commit**: Make clean, atomic commits following the conventional commits guidelines.
4. **Test**: Run Solidity tests (`forge test`) and compile the frontend (`npm run build`) before opening a pull request.
5. **PR**: Open a pull request against the `main` branch of the upstream repository.

## Development Guidelines

### Smart Contracts
* Write Solidity v0.8.24 compatible code.
* Always write unit tests in Foundry under the `test/` directory for any contract changes.
* Ensure all files include the SPDX-License-Identifier header.

### Backend API
* Do not introduce any hardcoded pricing or routing rules.
* Ensure code passes strict static code checking and runtime error checking.
* Document new REST API parameters and env options.

### Frontend Client
* Ensure component styles are defined using CSS variables.
* Test responsiveness on both mobile viewports and desktop resolutions.
* Always check for MetaMask network status changes and wallet state edge cases.

## Code of Conduct

By participating in this project, you agree to abide by the Contributor Covenant Code of Conduct.

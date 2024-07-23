# Contributing to Perplexica

Hey there, thanks for deciding to contribute to Perplexica. Anything you help with will support the development of Perplexica and will make it better! This guide will help you get started with contributing to our project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Setting Up Your Environment](#setting-up-your-environment)
  - [Option 1: Using Docker (Recommended)](#option-1-using-docker-recommended)
  - [Option 2: Without Docker](#option-2-without-docker)
- [Development Workflow](#development-workflow)
- [Coding and Contribution Practices](#coding-and-contribution-practices)
- [Making Contributions](#making-contributions)
- [Coding Standards](#coding-standards)
- [Reporting Issues](#reporting-issues)
- [Help and Support](#help-and-support)

## Prerequisites

Before you begin, ensure you have the following installed:
- Git
- Node.js (version specified in the project's package.json)
- npm or yarn
- Docker and Docker Compose (if using the Docker setup)

## Project Structure

Perplexica's design consists of two main domains:

- **Frontend (`ui` directory)**: This is a Next.js application holding all user interface components. It's a self-contained environment that manages everything the user interacts with.
- **Backend (root and `src` directory)**: The backend logic is situated in the `src` folder, but the root directory holds the main `package.json` for backend dependency management.

## Setting Up Your Environment

Before diving into coding, setting up your local environment is key. You have two options: using Docker (recommended) or setting up without Docker.

### Option 1: Using Docker (Recommended)

This method provides a consistent development environment with hot reloading.

1. Ensure Docker and Docker Compose are installed on your system.

2. Fork the repository on GitHub.

3. Clone your forked repository:
   ```
   git clone https://github.com/your-username/perplexica.git
   cd perplexica
   ```

3. Copy the sample configuration files:
   ```
   cp sample.config.toml config.toml
   cp ui/.env.example ui/.env
   ```

4. Edit `config.toml` and `ui/.env` to add necessary configuration values.

5. Build and start the development environment:
   ```
   docker-compose -f docker-compose.dev.yaml up --build
   ```

The services will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

This setup includes hot reloading:
- Frontend code changes (in `ui` directory) are immediately reflected in the browser.
- Backend code changes (in `src` directory) automatically restart the backend service.
- Changes to `package.json` in either root or `ui` directory trigger an automatic rebuild.

### Option 2: Without Docker

#### Backend Setup

1. In the root directory, locate the `sample.config.toml` file.
2. Rename it to `config.toml` and fill in the necessary configuration fields specific to the backend.
3. Run `npm install` to install dependencies.
4. Use `npm run dev` to start the backend in development mode.

#### Frontend Setup

1. Navigate to the `ui` folder and repeat the process of renaming `.env.example` to `.env`, making sure to provide the frontend-specific variables.
2. Execute `npm install` within the `ui` directory to get the frontend dependencies ready.
3. Launch the frontend development server with `npm run dev`.

**Please note**: While Docker configurations are present for setting up production environments, `npm run dev` is used for development purposes in the non-Docker setup.

## Development Workflow

1. Create a new branch for your feature or bug fix:
   ```
   git checkout -b feature/your-feature-name
   ```

2. Make your changes in the appropriate directories (`src` for backend, `ui` for frontend).

3. Test your changes thoroughly.

4. Run the formatter:
   ```
   npm run format:write
   ```

5. Commit your changes with a descriptive commit message:
   ```
   git commit -am "Add your commit message here"
   ```

6. Push your branch to GitHub:
   ```
   git push origin feature/your-feature-name
   ```

7. Open a pull request on GitHub, describing your changes in detail.

## Coding and Contribution Practices

Before committing changes:

1. Ensure that your code functions correctly by thorough testing.
2. Always run `npm run format:write` to format your code according to the project's coding standards. This helps maintain consistency and code quality.
3. Write clear, concise commit messages that explain the purpose of your changes.
4. Keep your pull requests focused on a single feature or bug fix.
5. Update documentation, including README.md and inline comments, if your changes affect the project's usage or setup.

We currently do not have a formal code of conduct, but it is in the works. In the meantime, please be mindful of how you engage with the project and its community. We expect all contributors to be respectful, inclusive, and professional in their interactions.

## Making Contributions

1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Issue that pull request!

## Coding Standards

- Follow the existing code style and structure.
- Write clear, commented code. Use JSDoc comments for functions and classes.
- Write clear, commented code.
- Ensure type safety by using TypeScript effectively.
- Write unit tests for new features when applicable.

## Reporting Issues

If you find a bug or have a suggestion for improvement:

1. Check if the issue already exists in the GitHub issue tracker.
2. If not, create a new issue, providing as much detail as possible, including:
   - A clear and descriptive title
   - Steps to reproduce the issue
   - Expected behavior
   - Actual behavior
   - Your environment (OS, browser, version, etc.)
   - Any relevant screenshots or error messages

## Help and Support

If you have any questions or feedback, please feel free to reach out to us. You can:

  - Create an issue on GitHub for project-related questions.

We appreciate your contributions and look forward to your involvement in making Perplexica even better!
# Contributing to OpenBlaze

Thank you for your interest in contributing to OpenBlaze! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

- **Be respectful**: Treat everyone with respect and kindness
- **Be inclusive**: Welcome newcomers and help them get started
- **Be collaborative**: Work together to improve the project
- **Be constructive**: Provide helpful feedback and suggestions

## Getting Started

### Prerequisites

- Node.js 16 or higher
- pnpm (recommended) or npm
- Git
- Chrome browser for testing

### Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/openblaze.git
   cd openblaze
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the extension**
   ```bash
   pnpm run build
   ```

4. **Load in Chrome**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

5. **Start development**
   ```bash
   pnpm run dev
   ```

## Contributing Guidelines

### Types of Contributions

We welcome several types of contributions:

- **Bug fixes**: Fix issues and improve stability
- **Features**: Add new functionality
- **Documentation**: Improve docs, guides, and examples
- **Testing**: Add or improve tests
- **Performance**: Optimize code and improve efficiency
- **UI/UX**: Enhance user interface and experience

### Before You Start

1. **Check existing issues**: Look for related issues or discussions
2. **Create an issue**: For new features or significant changes
3. **Discuss first**: For major changes, discuss with maintainers
4. **Start small**: Begin with small contributions to get familiar

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make Changes

- Follow the coding standards
- Write clear, concise commit messages
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run tests
pnpm test

# Build and test extension
pnpm run build

# Type checking
pnpm run type-check

# Linting
pnpm run lint
```

### 4. Commit Guidelines

Use conventional commit messages:

```
type(scope): description

feat(snippets): add snippet import functionality
fix(expansion): resolve cursor positioning issue
docs(readme): update installation instructions
test(engine): add expansion engine tests
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring
- `style`: Code style changes
- `perf`: Performance improvements

### 5. Submit Pull Request

1. Push your branch to your fork
2. Create a pull request from your branch
3. Fill out the PR template completely
4. Link related issues
5. Request review from maintainers

## Issue Guidelines

### Bug Reports

When reporting bugs, include:

- **Clear title**: Descriptive summary of the issue
- **Environment**: Browser version, OS, extension version
- **Steps to reproduce**: Detailed steps to recreate the bug
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots**: If applicable
- **Console errors**: Any error messages

### Feature Requests

For feature requests, include:

- **Clear description**: What feature you'd like to see
- **Use case**: Why this feature would be useful
- **Examples**: Similar features in other tools
- **Implementation ideas**: If you have suggestions

### Questions

For questions:

- Check existing documentation first
- Search existing issues
- Use GitHub Discussions for general questions
- Be specific about what you're trying to achieve

## Development Workflow

### Project Structure

```
src/
├── background/          # Background service worker
├── content/            # Content scripts
├── popup/              # Extension popup
├── options/            # Settings page
├── engine/             # Text expansion engine
├── storage/            # Data storage
├── utils/              # Utility functions
├── types/              # TypeScript types
└── data/               # Default data
```

### Coding Standards

#### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` type when possible
- Use strict mode settings

#### Code Style

- Use ESLint and Prettier configurations
- 2 spaces for indentation
- Semicolons required
- Single quotes for strings
- Trailing commas in objects/arrays

#### Naming Conventions

- `camelCase` for variables and functions
- `PascalCase` for classes and types
- `UPPER_SNAKE_CASE` for constants
- Descriptive names over short names

### Architecture Guidelines

#### Separation of Concerns

- Keep UI logic separate from business logic
- Use dependency injection where appropriate
- Maintain clear boundaries between modules

#### Error Handling

- Always handle errors gracefully
- Log errors with appropriate context
- Provide user-friendly error messages
- Don't expose internal errors to users

#### Performance

- Minimize memory usage
- Avoid blocking operations
- Use debouncing for frequent operations
- Optimize for common use cases

## Testing

### Test Types

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test complete user workflows

### Writing Tests

- Write tests for new features
- Test edge cases and error conditions
- Use descriptive test names
- Keep tests focused and isolated
- Mock external dependencies

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage
```

## Documentation

### Types of Documentation

1. **Code Comments**: Explain complex logic
2. **API Documentation**: Document public interfaces
3. **User Guides**: Help users understand features
4. **Developer Docs**: Help contributors understand code

### Documentation Standards

- Write clear, concise documentation
- Include examples where helpful
- Keep documentation up to date
- Use proper markdown formatting

## Release Process

### Version Numbers

We use [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. Update version numbers
2. Update CHANGELOG.md
3. Run full test suite
4. Build and test extension
5. Create release notes
6. Tag release in Git

## Getting Help

### Resources

- **Documentation**: Check README and docs
- **Issues**: Search existing issues
- **Discussions**: Use GitHub Discussions
- **Code**: Read the source code

### Communication

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Pull Requests**: Code review and collaboration

## Recognition

Contributors will be recognized in:

- CONTRIBUTORS.md file
- Release notes
- Project documentation
- Special thanks in major releases

## License

By contributing to OpenBlaze, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to OpenBlaze! Your help makes this project better for everyone.

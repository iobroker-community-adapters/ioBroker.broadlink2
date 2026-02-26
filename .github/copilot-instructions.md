# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.5.7
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

---

## 📑 Table of Contents

1. [Project Context](#project-context)
2. [Code Quality & Standards](#code-quality--standards)
   - [Code Style Guidelines](#code-style-guidelines)
   - [ESLint Configuration](#eslint-configuration)
3. [Testing](#testing)
   - [Unit Testing](#unit-testing)
   - [Integration Testing](#integration-testing)
   - [API Testing with Credentials](#api-testing-with-credentials)
4. [Development Best Practices](#development-best-practices)
   - [Dependency Management](#dependency-management)
   - [HTTP Client Libraries](#http-client-libraries)
   - [Error Handling](#error-handling)
5. [Admin UI Configuration](#admin-ui-configuration)
   - [JSON-Config Setup](#json-config-setup)
   - [Translation Management](#translation-management)
6. [Documentation](#documentation)
   - [README Updates](#readme-updates)
   - [Changelog Management](#changelog-management)
7. [CI/CD & GitHub Actions](#cicd--github-actions)
   - [Workflow Configuration](#workflow-configuration)
   - [Testing Integration](#testing-integration)
8. [Broadlink2-Specific Patterns](#broadlink2-specific-patterns)

---

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

## Adapter-Specific Context

**Adapter Name**: ioBroker.broadlink2
**Primary Function**: Controls BroadLink compatible wireless devices including RM++ (IR/RF remotes), SP++ (smart plugs), A1 (environmental sensors), T1 (thermostats), S1C (security devices), Floureon, LB1 (smart bulbs), and other OEM products.

**Key Features**:
- Network scanning and automatic device discovery
- IR/RF remote control learning and transmission (RM series)
- Smart switch control and status polling (SP series)
- Environmental monitoring (A1 sensors)
- Scene execution (actions on multiple devices)
- Device state management and persistence

**Hardware Communication**:
- UDP broadcast for device discovery on local network
- Direct IP communication with individual devices
- Device authentication and encryption protocols
- Support for cross-network device access

**Device Categories**:
- **RM Series**: IR/RF remote controllers (RM2, RM3, RM4, RM Mini, RM Pro, etc.)
- **SP Series**: Smart plugs/switches (SP1, SP2, SP3, SPMini, etc.)
- **Environmental**: A1 sensors (temperature, humidity, air quality)
- **Lighting**: LB1 smart bulbs with color/brightness control
- **Security**: S1C door sensors and motion detectors

---

## Code Quality & Standards

### Code Style Guidelines

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

**Timer and Resource Cleanup Example:**
```javascript
private connectionTimer?: NodeJS.Timeout;

async onReady() {
  this.connectionTimer = setInterval(() => this.checkConnection(), 30000);
}

onUnload(callback) {
  try {
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    callback();
  } catch (e) {
    callback();
  }
}
```

### ESLint Configuration

**CRITICAL:** ESLint validation must run FIRST in your CI/CD pipeline, before any other tests. This "lint-first" approach catches code quality issues early.

#### Setup
```bash
npm install --save-dev eslint @iobroker/eslint-config
```

#### Configuration (.eslintrc.json)
```json
{
  "extends": "@iobroker/eslint-config",
  "rules": {
    // Add project-specific rule overrides here if needed
  }
}
```

#### Package.json Scripts
```json
{
  "scripts": {
    "lint": "eslint --max-warnings 0 .",
    "lint:fix": "eslint . --fix"
  }
}
```

#### Best Practices
1. ✅ Run ESLint before committing — fix ALL warnings, not just errors
2. ✅ Use `lint:fix` for auto-fixable issues
3. ✅ Don't disable rules without documentation
4. ✅ Lint all relevant files (main code, tests, build scripts)
5. ✅ Keep `@iobroker/eslint-config` up to date
6. ✅ **ESLint warnings are treated as errors in CI** (`--max-warnings 0`). The `lint` script above already includes this flag — run `npm run lint` to match CI behavior locally

#### Common Issues
- **Unused variables**: Remove or prefix with underscore (`_variable`)
- **Missing semicolons**: Run `npm run lint:fix`
- **Indentation**: Use 4 spaces (ioBroker standard)
- **console.log**: Replace with `adapter.log.debug()` or remove

---

## Testing

### Unit Testing

- Use Jest as the primary testing framework
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files

**Example Structure:**
```javascript
describe('AdapterName', () => {
  let adapter;

  beforeEach(() => {
    // Setup test adapter instance
  });

  test('should initialize correctly', () => {
    // Test adapter initialization
  });
});
```

### Integration Testing

**CRITICAL:** Use the official `@iobroker/testing` framework. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation:** https://github.com/ioBroker/testing

#### Framework Structure

**✅ Correct Pattern:**
```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        // Get adapter object
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.broadlink2.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });

                        if (!obj) return reject(new Error('Adapter object not found'));

                        // Configure adapter
                        Object.assign(obj.native, {
                            interface: '',
                            poll: 30,
                        });

                        harness.objects.setObject(obj._id, obj);

                        // Start and wait
                        await harness.startAdapterAndWait();
                        await new Promise(resolve => setTimeout(resolve, 15000));

                        // Verify states
                        const stateIds = await harness.dbConnection.getStateIDs('broadlink2.0.*');

                        if (stateIds.length > 0) {
                            console.log('✅ Adapter successfully created states');
                            await harness.stopAdapter();
                            resolve(true);
                        } else {
                            reject(new Error('Adapter did not create any states'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).timeout(40000);
        });
    }
});
```

#### Broadlink2-Specific Testing Patterns

For testing Broadlink device interactions without physical hardware:

```javascript
describe('Broadlink Device Communication', () => {
    beforeEach(() => {
        // Mock network discovery
        mockDiscovery = sinon.stub(broadlink, 'discover').resolves([mockDevice]);

        // Mock device authentication
        mockAuth = sinon.stub(mockDevice, 'auth').resolves(true);

        // Mock command sending
        mockSendData = sinon.stub(mockDevice, 'sendData').resolves();
    });

    test('should discover devices on network', async () => {
        const devices = await adapter.scanDevices();
        expect(devices).toBeDefined();
        expect(mockDiscovery.called).toBe(true);
    });

    test('should handle device authentication failure', async () => {
        mockAuth.rejects(new Error('Auth failed'));
        await expect(adapter.authenticateDevice(mockDevice)).rejects.toThrow('Auth failed');
    });
});
```

#### Testing Success AND Failure Scenarios

**IMPORTANT:** For every "it works" test, implement corresponding "it fails gracefully" tests.

**Failure Scenario Example:**
```javascript
it('should NOT poll SP1 devices (not supported)', function () {
    return new Promise(async (resolve, reject) => {
        try {
            harness = getHarness();
            const obj = await new Promise((res, rej) => {
                harness.objects.getObject('system.adapter.broadlink2.0', (err, o) => {
                    if (err) return rej(err);
                    res(o);
                });
            });

            if (!obj) return reject(new Error('Adapter object not found'));

            Object.assign(obj.native, { poll: 30 });

            await new Promise((res, rej) => {
                harness.objects.setObject(obj._id, obj, (err) => {
                    if (err) return rej(err);
                    res(undefined);
                });
            });

            await harness.startAdapterAndWait();
            await new Promise((res) => setTimeout(res, 20000));

            // SP1 devices do not support power polling — verify no error state
            const stateIds = await harness.dbConnection.getStateIDs('broadlink2.0.*');
            console.log('✅ Adapter ran without crash for unsupported device type');
            resolve(true);

            await harness.stopAdapter();
        } catch (error) {
            reject(error);
        }
    });
}).timeout(40000);
```

#### Key Rules

1. ✅ Use `@iobroker/testing` framework
2. ✅ Configure via `harness.objects.setObject()`
3. ✅ Start via `harness.startAdapterAndWait()`
4. ✅ Verify states via `harness.states.getState()`
5. ✅ Allow proper timeouts for async operations
6. ❌ NEVER test hardware directly in CI
7. ❌ NEVER bypass the harness system

#### Workflow Dependencies

Integration tests should run ONLY after lint and adapter tests pass:

```yaml
integration-tests:
  needs: [check-and-lint, adapter-tests]
  runs-on: ubuntu-22.04
```

### API Testing with Credentials

For adapters connecting to external APIs requiring authentication:

#### Password Encryption for Integration Tests

```javascript
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    if (!systemConfig?.native?.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }

    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    return result;
}
```

---

## Development Best Practices

### Dependency Management

- Always use `npm` for dependency management
- Use `npm ci` for installing existing dependencies (respects package-lock.json)
- Use `npm install` only when adding or updating dependencies
- Keep dependencies minimal and focused
- Only update dependencies in separate Pull Requests

**When modifying package.json:**
1. Run `npm install` to sync package-lock.json
2. Commit both package.json and package-lock.json together

**Best Practices:**
- Prefer built-in Node.js modules when possible
- Use `@iobroker/adapter-core` for adapter base functionality
- Avoid deprecated packages
- Document specific version requirements

### HTTP Client Libraries

- **Preferred:** Use native `fetch` API (Node.js 20+ required)
- **Avoid:** `axios` unless specific features are required

**Example with fetch:**
```javascript
try {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
} catch (error) {
  this.log.error(`API request failed: ${error.message}`);
}
```

**Other Recommendations:**
- **Logging:** Use adapter built-in logging (`this.log.*`)
- **Scheduling:** Use adapter built-in timers and intervals
- **File operations:** Use Node.js `fs/promises`
- **Configuration:** Use adapter config system

### Error Handling

- Always catch and log errors appropriately
- Use adapter log levels (error, warn, info, debug)
- Provide meaningful, user-friendly error messages
- Handle network failures gracefully
- Implement retry mechanisms where appropriate
- Always clean up timers, intervals, and resources in `unload()` method

**Example:**
```javascript
try {
  await this.connectToDevice();
} catch (error) {
  this.log.error(`Failed to connect to device: ${error.message}`);
  this.setState('info.connection', false, true);
  // Implement retry logic if needed
}
```

---

## Admin UI Configuration

### JSON-Config Setup

Use JSON-Config format for modern ioBroker admin interfaces.

**Example Structure:**
```json
{
  "type": "panel",
  "items": {
    "host": {
      "type": "text",
      "label": "Host address",
      "help": "IP address or hostname of the device"
    }
  }
}
```

**Guidelines:**
- ✅ Use consistent naming conventions
- ✅ Provide sensible default values
- ✅ Include validation for required fields
- ✅ Add tooltips for complex options
- ✅ Ensure translations for all supported languages (minimum English and German)
- ✅ Write end-user friendly labels, avoid technical jargon

### Broadlink2-Specific Admin UI Patterns

```javascript
// State validation in adapter code
validateConfig(config) {
    const errors = [];

    if (config.poll && (config.poll < 0 || config.poll > 3600)) {
        errors.push('Poll interval must be between 0-3600 seconds');
    }

    if (config.interface && !this.isValidIP(config.interface)) {
        errors.push('Invalid interface IP address');
    }

    return errors;
}

// Apply configuration changes
async onReady() {
    const errors = this.validateConfig(this.config);
    if (errors.length > 0) {
        this.log.error(`Configuration errors: ${errors.join(', ')}`);
        return;
    }

    // Proceed with adapter initialization
}
```

### Translation Management

**CRITICAL:** Translation files must stay synchronized with `admin/jsonConfig.json`. Orphaned keys or missing translations cause UI issues and PR review delays.

#### Overview
- **Location:** `admin/i18n/{lang}/translations.json` for 11 languages (de, en, es, fr, it, nl, pl, pt, ru, uk, zh-cn)
- **Source of truth:** `admin/jsonConfig.json` - all `label` and `help` properties must have translations
- **Command:** `npm run translate` - auto-generates translations but does NOT remove orphaned keys
- **Formatting:** English uses tabs, other languages use 4 spaces

#### Critical Rules
1. ✅ Keys must match exactly with jsonConfig.json
2. ✅ No orphaned keys in translation files
3. ✅ All translations must be in native language (no English fallbacks)
4. ✅ Keys must be sorted alphabetically

#### Workflow for Translation Updates

**When modifying admin/jsonConfig.json:**

1. Make your changes to labels/help texts
2. Run automatic translation: `npm run translate`
3. Run validation: `node scripts/validate-translations.js`
4. Remove orphaned keys manually from all translation files
5. Add missing translations in native languages
6. Run: `npm run lint && npm run test`

#### Add Validation to package.json

```json
{
  "scripts": {
    "translate": "translate-adapter",
    "validate:translations": "node scripts/validate-translations.js",
    "pretest": "npm run lint && npm run validate:translations"
  }
}
```

#### Translation Checklist

Before committing changes to admin UI or translations:
1. ✅ Validation script shows "All keys match!" for all 11 languages
2. ✅ No orphaned keys in any translation file
3. ✅ All translations in native language
4. ✅ Keys alphabetically sorted
5. ✅ `npm run lint` passes
6. ✅ `npm run test` passes
7. ✅ Admin UI displays correctly

---

## Documentation

### README Updates

#### Required Sections
1. **Installation** - Clear npm/ioBroker admin installation steps
2. **Configuration** - Detailed configuration options with examples
3. **Usage** - Practical examples and use cases
4. **Changelog** - Version history (use "## **WORK IN PROGRESS**" for ongoing changes)
5. **License** - License information (typically MIT for ioBroker adapters)
6. **Support** - Links to issues, discussions, community support

#### Documentation Standards
- Use clear, concise language
- Include code examples for configuration
- Add screenshots for admin interface when applicable
- Maintain multilingual support (minimum English and German)
- Always reference issues in commits and PRs (e.g., "fixes #xx")

#### Mandatory README Updates for PRs

For **every PR or new feature**, always add a user-friendly entry to README.md:

- Add entries under `## **WORK IN PROGRESS**` section
- Use format: `* (author) **TYPE**: Description of user-visible change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements), **TESTING** (test additions), **CI/CD** (automation)
- Focus on user impact, not technical details

**Example:**
```markdown
## **WORK IN PROGRESS**

* (DutchmanNL) **FIXED**: Adapter now properly validates login credentials (fixes #25)
* (DutchmanNL) **NEW**: Added device discovery to simplify initial setup
```

### Changelog Management

Follow the [AlCalzone release-script](https://github.com/AlCalzone/release-script) standard.

#### Format Requirements

```markdown
# Changelog

<!--
  Placeholder for the next version (at the beginning of the line):
  ## **WORK IN PROGRESS**
-->

## **WORK IN PROGRESS**

- (author) **NEW**: Added new feature X
- (author) **FIXED**: Fixed bug Y (fixes #25)

## v0.1.0 (2023-01-01)
Initial release
```

#### Workflow Process
- **During Development:** All changes go under `## **WORK IN PROGRESS**`
- **For Every PR:** Add user-facing changes to WORK IN PROGRESS section
- **Before Merge:** Version number and date added when merging to main
- **Release Process:** Release-script automatically converts placeholder to actual version

#### Change Entry Format
- Format: `- (author) **TYPE**: User-friendly description`
- Types: **NEW**, **FIXED**, **ENHANCED**
- Focus on user impact, not technical implementation
- Reference issues: "fixes #XX" or "solves #XX"

---

## CI/CD & GitHub Actions

### Workflow Configuration

#### GitHub Actions Best Practices

**Must use ioBroker official testing actions:**
- `ioBroker/testing-action-check@v1` for lint and package validation
- `ioBroker/testing-action-adapter@v1` for adapter tests
- `ioBroker/testing-action-deploy@v1` for automated releases with Trusted Publishing (OIDC)

**Configuration:**
- **Node.js versions:** Test on 20.x, 22.x, 24.x
- **Platform:** Use ubuntu-22.04
- **Automated releases:** Deploy to npm on version tags (requires NPM Trusted Publishing)
- **Monitoring:** Include Sentry release tracking for error monitoring

#### Critical: Lint-First Validation Workflow

**ALWAYS run ESLint checks BEFORE other tests.** Benefits:
- Catches code quality issues immediately
- Prevents wasting CI resources on tests that would fail due to linting errors
- Provides faster feedback to developers
- Enforces consistent code quality

**Workflow Dependency Configuration:**
```yaml
jobs:
  check-and-lint:
    # Runs ESLint and package validation
    # Uses: ioBroker/testing-action-check@v1

  adapter-tests:
    needs: [check-and-lint]  # Wait for linting to pass
    # Run adapter unit tests

  integration-tests:
    needs: [check-and-lint, adapter-tests]  # Wait for both
    # Run integration tests
```

**Key Points:**
- The `check-and-lint` job has NO dependencies - runs first
- ALL other test jobs MUST list `check-and-lint` in their `needs` array
- If linting fails, no other tests run, saving time
- Fix all ESLint errors before proceeding

### Testing Integration

#### API Testing in CI/CD

For adapters with external API dependencies:

```yaml
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  runs-on: ubuntu-22.04

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run demo API tests
      run: npm run test:integration-demo
```

#### Testing Best Practices
- Run credential tests separately from main test suite
- Don't make credential tests required for deployment
- Provide clear failure messages for API issues
- Use appropriate timeouts for external calls (120+ seconds)

#### Package.json Integration
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

---

## Broadlink2-Specific Patterns

### Error Handling and Logging

#### Device Connection Errors
```javascript
try {
    await device.auth();
    await device.sendData(command);
} catch (error) {
    if (error.code === 'EHOSTUNREACH') {
        this.log.warn(`Device ${deviceName} unreachable - marking as offline`);
        await this.setState(`${deviceId}.info.connection`, false, true);
    } else if (error.message.includes('Authentication')) {
        this.log.error(`Device ${deviceName} authentication failed - check device setup`);
    } else {
        this.log.error(`Device ${deviceName} communication error: ${error.message}`);
    }
}
```

#### Network Discovery Error Handling
```javascript
async scanForDevices() {
    try {
        const devices = await broadlink.discover({
            address: this.config.interface || undefined
        });

        if (devices.length === 0) {
            this.log.info('No Broadlink devices found on network');
            return [];
        }

        return devices;
    } catch (error) {
        this.log.error(`Network scan failed: ${error.message}`);
        if (error.code === 'EADDRINUSE') {
            this.log.error('Network interface busy - try different interface or restart adapter');
        }
        return [];
    }
}
```

### Device State Management

#### State Structure for Broadlink Devices
```javascript
// RM Series (IR/RF Controllers)
await this.setObjectNotExists(`${deviceId}.commands.learn`, {
    type: 'state',
    common: {
        name: 'Learn IR/RF Command',
        type: 'boolean',
        role: 'button',
        read: false,
        write: true
    }
});

// SP Series (Smart Plugs)
await this.setObjectNotExists(`${deviceId}.switch`, {
    type: 'state',
    common: {
        name: 'Switch State',
        type: 'boolean',
        role: 'switch',
        read: true,
        write: true
    }
});

// A1 Series (Environmental Sensors)
await this.setObjectNotExists(`${deviceId}.temperature`, {
    type: 'state',
    common: {
        name: 'Temperature',
        type: 'number',
        role: 'value.temperature',
        unit: '°C',
        read: true,
        write: false
    }
});
```

#### Learned Command Storage
```javascript
async storeLearnedCommand(deviceId, commandName, hexData) {
    const stateId = `${deviceId}.commands.${commandName}`;

    await this.setObjectNotExists(stateId, {
        type: 'state',
        common: {
            name: commandName,
            type: 'boolean',
            role: 'button',
            read: false,
            write: true
        },
        native: {
            code: hexData,  // Store hex code in native section
            deviceType: 'RM',
            learned: true
        }
    });
}
```

### Configuration Validation

#### Network Interface Validation
```javascript
validateNetworkConfig(config) {
    const errors = [];

    if (config.interface) {
        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (!ipRegex.test(config.interface)) {
            errors.push('Invalid IP address format for interface');
        }
    }

    if (config.poll && (config.poll < 0 || config.poll > 3600)) {
        errors.push('Poll interval must be between 0 and 3600 seconds');
    }

    return errors;
}
```

### Polling and Device Updates

#### Safe Polling Implementation
```javascript
async pollDeviceStates() {
    if (!this.config.poll || this.config.poll === 0) return;

    for (const [deviceId, device] of Object.entries(this.devices)) {
        try {
            if (device.type.startsWith('SP') && device.type !== 'SP1') {
                const powered = await device.check_power();
                await this.setState(`${deviceId}.switch`, powered, true);
            }

            if (device.type === 'A1') {
                const data = await device.check_sensors();
                if (data.temperature !== undefined) {
                    await this.setState(`${deviceId}.temperature`, data.temperature, true);
                }
                if (data.humidity !== undefined) {
                    await this.setState(`${deviceId}.humidity`, data.humidity, true);
                }
            }
        } catch (error) {
            this.log.debug(`Failed to poll device ${deviceId}: ${error.message}`);
        }
    }

    this.pollTimeout = setTimeout(() => this.pollDeviceStates(), this.config.poll * 1000);
}
```

### Scene Management

#### Scene Execution with Error Recovery
```javascript
async executeScene(sceneName, sceneCommands) {
    this.log.info(`Executing scene: ${sceneName}`);

    for (const command of sceneCommands) {
        try {
            if (command.delay) {
                await this.delay(command.delay);
                continue;
            }

            const [deviceId, action, value] = command.split(',');
            const device = this.devices[deviceId];

            if (!device) {
                this.log.warn(`Scene ${sceneName}: Device ${deviceId} not found`);
                continue;
            }

            await this.executeDeviceCommand(device, action, value);

        } catch (error) {
            this.log.error(`Scene ${sceneName}: Command failed - ${error.message}`);
            // Continue with remaining commands even if one fails
        }
    }
}
```

### Cleanup and Resource Management

```javascript
async onUnload(callback) {
    try {
        // Clear polling timeouts
        if (this.pollTimeout) {
            clearTimeout(this.pollTimeout);
            this.pollTimeout = undefined;
        }

        // Clear device reconnection timers
        Object.values(this.reconnectTimers || {}).forEach(timer => {
            clearTimeout(timer);
        });

        // Close device connections
        Object.values(this.devices || {}).forEach(device => {
            if (device && typeof device.close === 'function') {
                try {
                    device.close();
                } catch (error) {
                    this.log.debug(`Error closing device: ${error.message}`);
                }
            }
        });

        this.log.info('Broadlink2 adapter stopped');
        callback();
    } catch (error) {
        this.log.error(`Error during unload: ${error.message}`);
        callback();
    }
}
```

### WebSocket and Real-time Updates

```javascript
// Broadcast device state changes to admin UI
broadcastDeviceUpdate(deviceId, state, value) {
    if (this.supportsFeature && this.supportsFeature('ADMIN_UI')) {
        this.sendTo('admin', 'deviceStateChanged', {
            deviceId: deviceId,
            state: state,
            value: value,
            timestamp: Date.now()
        });
    }
}

// Handle real-time device discovery updates
onDeviceDiscovered(device) {
    this.log.info(`New device found: ${device.type} at ${device.host}`);
    this.broadcastDeviceUpdate(device.mac, 'discovered', {
        type: device.type,
        host: device.host,
        mac: device.mac
    });
}
```

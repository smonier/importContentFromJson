module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: { '^.+\\.jsx?$': 'babel-jest' },
  moduleNameMapper: {
    // Mirror the webpack '~' alias -> src/javascript
    '^~/(.*)$': '<rootDir>/src/javascript/$1',
    // Stub style imports so component tests don't choke on SCSS
    '\\.(scss|css)$': '<rootDir>/jest.styleMock.js'
  }
};

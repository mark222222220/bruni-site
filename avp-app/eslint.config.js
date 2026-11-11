// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Правила «готовности к React Compiler». Компилятор в проекте не включён, а правила ругаются на обычные
    // приёмы React Native (Animated.Value в useRef, Date.now() при отрисовке). Оставлены предупреждениями,
    // чтобы настоящие ошибки не тонули среди них.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    ignores: ['dist/*'],
  },
]);

// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Rule dưới đây tắt riêng cho file test (*.spec.ts và test/**), KHÔNG
    // tắt cho src/libs — code sản phẩm thật vẫn phải qua đủ các rule
    // no-unsafe-* này.
    //
    // Lý do: test file trong repo dùng 3 nguồn dữ liệu vốn dĩ untyped mà
    // typescript-eslint không có cách nào phân biệt được với "any rò rỉ từ
    // lỗi thật":
    //   - Jest mock object (mockPrismaService.post.findFirst...) là plain
    //     object literal, không phải class instance thật — unbound-method
    //     được thiết kế bắt lỗi `this` bị mất khi tách method khỏi class
    //     instance, không áp dụng cho mock.
    //   - `expect.any(Date)`/`expect.anything()` của Jest và response body
    //     của supertest (`request(...).body`) đều typed `any` theo chính
    //     @types/jest và supertest, không phải do code trong repo viết any.
    //   - `mockImplementation(async (...) => ...)` thường không có await
    //     thật bên trong (chỉ cần trả Promise cho khớp signature) —
    //     require-await báo đúng cú pháp nhưng không phải bug.
    // Đã kiểm tra thủ công một phần các lỗi trước khi tắt (xem
    // posts-public.service.spec.ts) để xác nhận đúng là nhiễu do typing,
    // không che giấu bug thật nào.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
);

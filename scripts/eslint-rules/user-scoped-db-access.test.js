"use strict";

const { RuleTester } = require("eslint");
const rule = require("./user-scoped-db-access");

const ruleTester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
});

ruleTester.run("user-scoped-db-access", rule, {
  valid: [
    {
      code: `
        const scope = await getCurrentUserDataScope();
        const account = await scope.findOwned(database.get("accounts"), id);
      `,
      filename: "apps/mobile/services/account-reader.ts",
    },
    {
      code: `
        const accountsCollection = database.get("accounts");
        const query = queryOwned(accountsCollection, userId, Q.where("deleted", false));
      `,
      filename: "apps/mobile/hooks/useAccounts.ts",
    },
    {
      code: `
        const categoriesCollection = database.get("categories");
        const category = await scope.findAccessibleCategory(categoriesCollection, id);
      `,
      filename: "apps/mobile/services/category-reader.ts",
    },
    {
      code: `
        const categoriesCollection = database.get("categories");
        const categories = await scope.queryAccessibleCategories(categoriesCollection, Q.where("deleted", false)).fetch();
      `,
      filename: "apps/mobile/services/category-reader.ts",
    },
    {
      code: `
        const rates = database.get("market_rates").query(Q.take(1));
      `,
      filename: "apps/mobile/hooks/useMarketRates.ts",
    },
    {
      code: `
        const profile = await database.get("profiles").find(id);
      `,
      filename: "apps/mobile/services/sync.ts",
    },
    {
      code: `
        const account = await database.get("accounts").find(id);
      `,
      filename: "apps/mobile/services/account-reader.spec.ts",
    },
  ],
  invalid: [
    {
      code: `
        const account = await database.get("accounts").find(id);
      `,
      filename: "apps/mobile/services/account-reader.ts",
      errors: [{ message: /Use getCurrentUserDataScope/ }],
    },
    {
      code: `
        const accountsCollection = database.get("accounts");
        const accounts = await accountsCollection.query(Q.where("user_id", userId)).fetch();
      `,
      filename: "apps/mobile/hooks/useAccounts.ts",
      errors: [{ message: /Use getCurrentUserDataScope/ }],
    },
    {
      code: `
        const categoriesCollection = database.get("categories");
        const categories = await categoriesCollection.query(Q.where("deleted", false)).fetch();
      `,
      filename: "apps/mobile/context/CategoriesContext.tsx",
      errors: [{ message: /mixed-visibility table 'categories'/ }],
    },
    {
      code: `
        const account = await database.get("accounts").findAndObserve(id);
      `,
      filename: "apps/mobile/hooks/useAccountById.ts",
      errors: [{ message: /Use getCurrentUserDataScope/ }],
    },
    {
      code: `
        const metals = database.get("asset_metals").query(Q.where("deleted", false));
      `,
      filename: "apps/mobile/hooks/useAssetBreakdown.ts",
      errors: [{ message: /child-owned table 'asset_metals'/ }],
    },
    {
      code: `
        const details = await database.get("bank_details").find(id);
      `,
      filename: "apps/mobile/hooks/useAccounts.ts",
      errors: [{ message: /child-owned table 'bank_details'/ }],
    },
    {
      code: `
        const snapshots = database.get("daily_snapshot_balance").query(Q.take(1));
      `,
      filename: "apps/mobile/hooks/useBalanceSnapshots.ts",
      errors: [{ message: /user-owned table 'daily_snapshot_balance'/ }],
    },
  ],
});

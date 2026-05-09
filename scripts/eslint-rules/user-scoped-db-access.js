"use strict";

const DIRECT_USER_OWNED_TABLES = new Set([
  "accounts",
  "assets",
  "budgets",
  "daily_snapshot_assets",
  "daily_snapshot_balance",
  "daily_snapshot_net_worth",
  "debts",
  "profiles",
  "recurring_payments",
  "transactions",
  "transfers",
  "user_category_settings",
]);

const CHILD_USER_OWNED_TABLES = new Set(["asset_metals", "bank_details"]);

const MIXED_VISIBILITY_TABLES = new Set(["categories"]);

const ALLOWED_FILE_SUFFIXES = [
  "apps/mobile/services/user-data-access.ts",
  "apps/mobile/services/sync.ts",
];

function normalizePath(fileName) {
  return fileName.replace(/\\/g, "/");
}

function isAllowedFile(fileName) {
  const normalized = normalizePath(fileName);
  return ALLOWED_FILE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isTestFile(fileName) {
  const normalized = normalizePath(fileName);
  return (
    normalized.includes("/__tests__/") ||
    normalized.endsWith(".test.ts") ||
    normalized.endsWith(".test.tsx") ||
    normalized.endsWith(".spec.ts") ||
    normalized.endsWith(".spec.tsx")
  );
}

function getPropertyName(memberExpression) {
  if (!memberExpression || memberExpression.type !== "MemberExpression") {
    return null;
  }

  const property = memberExpression.property;
  if (property.type === "Identifier") {
    return property.name;
  }

  if (property.type === "Literal" && typeof property.value === "string") {
    return property.value;
  }

  return null;
}

function getLiteralString(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  return null;
}

function getDatabaseGetTable(callExpression) {
  if (!callExpression || callExpression.type !== "CallExpression") {
    return null;
  }

  const callee = callExpression.callee;
  if (!callee || callee.type !== "MemberExpression") {
    return null;
  }

  if (getPropertyName(callee) !== "get") {
    return null;
  }

  if (
    callee.object.type !== "Identifier" ||
    callee.object.name !== "database"
  ) {
    return null;
  }

  return getLiteralString(callExpression.arguments[0]);
}

function isScopedHelperCall(callExpression) {
  if (!callExpression || callExpression.type !== "CallExpression") {
    return false;
  }

  const callee = callExpression.callee;
  if (callee.type === "Identifier") {
    return (
      callee.name === "queryOwned" ||
      callee.name === "queryAccessibleCategories" ||
      callee.name === "findOwnedById" ||
      callee.name === "observeOwnedById" ||
      callee.name === "queryChildrenOfOwnedParent" ||
      callee.name === "queryChildrenOfOwnedParents"
    );
  }

  if (callee.type !== "MemberExpression") {
    return false;
  }

  const propertyName = getPropertyName(callee);
  return (
    propertyName === "queryOwned" ||
    propertyName === "queryAccessibleCategories" ||
    propertyName === "findOwned" ||
    propertyName === "findAccessibleCategory" ||
    propertyName === "queryChildrenOfOwnedParent" ||
    propertyName === "queryChildrenOfOwnedParents" ||
    propertyName === "assertChildRecordParentOwned"
  );
}

function isProtectedTable(tableName) {
  return (
    DIRECT_USER_OWNED_TABLES.has(tableName) ||
    CHILD_USER_OWNED_TABLES.has(tableName) ||
    MIXED_VISIBILITY_TABLES.has(tableName)
  );
}

function getTableKind(tableName) {
  if (CHILD_USER_OWNED_TABLES.has(tableName)) return "child";
  return MIXED_VISIBILITY_TABLES.has(tableName) ? "mixed" : "owned";
}

function getCollectionNameFromMemberObject(node, collectionVariables) {
  if (!node) return null;

  if (node.type === "Identifier") {
    return collectionVariables.get(node.name) ?? null;
  }

  if (node.type === "CallExpression") {
    return getDatabaseGetTable(node);
  }

  return null;
}

function getMessage(tableName, accessKind) {
  const tableKind = getTableKind(tableName);
  if (tableKind === "mixed") {
    return `Avoid direct ${accessKind} access to mixed-visibility table '${tableName}'. Use user-data-access category helpers so system rows and current-user rows are handled together.`;
  }

  if (tableKind === "child") {
    return `Avoid direct ${accessKind} access to child-owned table '${tableName}'. Use user-data-access child helpers with a verified owned parent instead.`;
  }

  return `Avoid direct ${accessKind} access to user-owned table '${tableName}'. Use getCurrentUserDataScope(), queryOwned(), findOwnedById(), or observeOwnedById() instead.`;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require scoped helper APIs for local WatermelonDB access to user-owned data.",
      recommended: false,
    },
    schema: [],
    messages: {
      unsafeAccess: "{{message}}",
    },
  },

  create(context) {
    if (
      isAllowedFile(context.getFilename()) ||
      isTestFile(context.getFilename())
    ) {
      return {};
    }

    const collectionVariables = new Map();

    return {
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== "Identifier") {
          return;
        }

        const tableName = getDatabaseGetTable(node.init);
        if (tableName && isProtectedTable(tableName)) {
          collectionVariables.set(node.id.name, tableName);
        }
      },

      CallExpression(node) {
        if (isScopedHelperCall(node)) {
          return;
        }

        const callee = node.callee;
        if (!callee || callee.type !== "MemberExpression") {
          return;
        }

        const methodName = getPropertyName(callee);
        if (
          methodName !== "find" &&
          methodName !== "findAndObserve" &&
          methodName !== "query"
        ) {
          return;
        }

        const tableName = getCollectionNameFromMemberObject(
          callee.object,
          collectionVariables
        );
        if (!tableName || !isProtectedTable(tableName)) {
          return;
        }

        context.report({
          node,
          messageId: "unsafeAccess",
          data: {
            message: getMessage(tableName, methodName),
          },
        });
      },
    };
  },
};

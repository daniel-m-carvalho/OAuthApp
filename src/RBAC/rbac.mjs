import { newEnforcer } from "casbin";
import path from "path";
import url from "url";

// PDP - decide if request is accepted or denied
async function pdp(s, o, a) {
  const currDir = url.fileURLToPath(new URL(".", import.meta.url));
  const modelPath = path.resolve(currDir, "model.conf");
  const policyPath = path.resolve(currDir, "policy.csv");
  const enforcer = await newEnforcer(modelPath, policyPath);
  const roles = await enforcer.getImplicitRolesForUser(s);
  const role = Object.values(roles)[0];
  const r = await enforcer.enforce(s, o, a);
  return { res: r, sub: s, obj: o, act: a, roles: role };
}

export default async function (req, rsp, next, container) {
  try {
    const email = container.email;
    let data = undefined;
    const url = req.url;
    if (url.includes("task")) data = "tasks";
    else if (url.includes("git")) data = "milestones";
    let action = undefined;
    if (url.includes("new")) action = "write";
    else if (req.method == "GET") action = "read";
    const p = await pdp(email, data, action);

    if (p.res) {
      //Set role cookie
      if (req.cookie == undefined)
        rsp.cookie("role", p.roles, { httpOnly: true });
      return;
    } else {
      const error = new Error(
        "Forbidden - You don't have permission to access this resource."
      );
      error.code = "403";
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

/*
// Do action or not, based on decision
const execute = function (decision) {
  console.log(decision);
  if (decision.res == true) {
    console.log("permit operation");
  } else {
    console.log("deny operation");
  }
};

// Test permissions
pdp("free", "tasks", "read").then(execute);
pdp("free", "tasks", "write").then(execute);
pdp("premium", "tasks", "read").then(execute);
pdp("premium", "tasks", "write").then(execute);
pdp("admin", "tasks", "read").then(execute);
pdp("admin", "tasks", "write").then(execute);
*/

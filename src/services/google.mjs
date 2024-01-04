import checkPermission from "../RBAC/rbac.mjs";
import crypto from "crypto";
import axios from "axios";
import FormData from "form-data";
import jwt from "jsonwebtoken";
import { access } from "fs";

const CALLBACK = "callback";

let credentials = {
  CLIENT_ID:
    "666288151556-4re22n09eqa2o0ipgne08s2u79rqt90k.apps.googleusercontent.com",
  CLIENT_SECRET: "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",
};

let container = [];

export default function () {
  return {
    authenticate: authenticate,
    callback: callback,
    taskLists: taskLists,
    tasks: tasks,
    task: task,
    newTask: newTask,
    addedNewTask: addedNewTask,
  };
}

function authenticate(req, res) {
  let state = crypto.randomUUID();
  res.cookie("state", state, { httpOnly: true });
  // redirect to authorization endpoint
  res.redirect(
    302,
    // authorization endpoint
    "https://accounts.google.com/o/oauth2/v2/auth?" +
      // client id
      "client_id=" +
      credentials.CLIENT_ID +
      "&" +
      // OpenID scope "openid email"
      "scope=openid%20email%20https://www.googleapis.com/auth/tasks&" +
      // parameter state is used to check if the user-agent requesting login is the same making the request to the callback URL
      "state=" +
      state +
      "&" +
      // responde_type for "authorization code grant"
      "response_type=code&" +
      // redirect uri used to register RP
      "redirect_uri=http://localhost:3001/" +
      CALLBACK +
      "/google"
  );
}

async function callback(req, res, next) {
  try {
    if (req.query.state != req.cookies.state) {
      res.status(400).send("Bad Request");
      return;
    }

    // Content-type: application/x-www-form-urlencoded (URL-Encoded Forms)
    const form = new FormData();
    form.append("code", req.query.code);
    form.append("client_id", credentials.CLIENT_ID);
    form.append("client_secret", credentials.CLIENT_SECRET);
    form.append(
      "redirect_uri",
      "http://localhost:3001/" + CALLBACK + "/google"
    );
    form.append("grant_type", "authorization_code");

    // Make a POST request to the token endpoint
    const response = await axios.post(
      "https://www.googleapis.com/oauth2/v3/token",
      form,
      { headers: form.getHeaders() }
    );

    // Decode id_token from base64 encoding (note: decode does not verify signature)
    const jwt_payload = jwt.decode(response.data.id_token);

    const userInfo = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${response.data.access_token}` },
      }
    );

    // Set cookies
    const session = crypto.randomUUID();
    container.push({
      session: session,
      token: response.data.access_token,
      email: userInfo.data.email,
    });

    res.cookie("googleSession", session, {
      expires: new Date(Date.now() + 900000),
      httpOnly: true,
    });
    // check user role
    await checkPermission(
      req,
      res,
      next,
      container.find((item) => item.token === response.data.access_token)
    );

    // HTML response with information from the authorization server
    res.send(`
        Go back to <a href="/">Home screen</a></div><br>
        See my <a href="/taskLists">Task List</a></div><br>
        <br><a href=/authenticate/github>Github repositories and milestones</a><br>
    `);
  } catch (error) {
    if (error.code == "403") {
      res.status(403).send(`
        <p>${error.message}</p>
        Go back to <a href="/">Home screen</a></div><br>
        `);
    } else {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  }
}

async function taskLists(req, res, next) {
  try {
    const cred = container.find(
      (item) => item.session === req.cookies.googleSession
    );
    // check user role - read task lists
    if (!cred) {
      res.status(400).send("Bad Request");
      return;
    }

    const response = await axios.get(
      "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
      {
        headers: {
          Authorization: `Bearer ${cred.token}`,
        },
      }
    );

    // check user role - read tasks
    await checkPermission(req, res, next, cred);

    if (Object.keys(req.query).length != 0) {
      res.send(`
        <h1>Task List</h1>
        <ul>
          ${response.data.items.map(
            (item) => `
              <li><div><code>Title: ${item.title}</code></div>
              <form method="GET" action="/tasklist/${item.id}/tasks/addednewtask">
                <input type="hidden" name="title" value="${req.query.title}">
                <input type="hidden" name="notes" value="${req.query.description}">
                <input type="hidden" name="updated" value="${req.query.updated}">
                <input type="hidden" name="due" value="${req.query.due}">
                <input type="submit" value="Add task">
              </form></li>
          `
          )}
        </ul>
        Go back to <a href="/">Home screen</a></div><br>
        <p>Your account: <b>${req.cookies.role}</b></p>
      `);
    } else {
      res.send(`
        <h1>Task List</h1>
        <ul>
          ${response.data.items.map(
            (item) => `
              <li><div><code>Title: ${item.title}</code></div>
              <button onClick="window.location.href='/tasklist/${item.id}/tasks';">Get tasks</button></li>
          `
          )}
        </ul>
        Go back to <a href="/">Home screen</a></div><br>
        <p>Your account: <b>${req.cookies.role}</b></p>
      `);
    }
  } catch (error) {
    if (error.code == "403") {
      res.status(403).send(`
          <p>${error.message}</p>
          Go back to <a href="/">Home screen</a></div><br>
        `);
    } else {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  }
}

async function tasks(req, res) {
  try {
    const cred = container.find(
      (item) => item.session === req.cookies.googleSession
    );
    // check user role - read task lists
    if (!cred) {
      res.status(400).send("Bad Request");
      return;
    }
    const response = await axios.get(
      "https://tasks.googleapis.com/tasks/v1/lists/" + req.params.id + "/tasks",
      {
        headers: {
          Authorization: `Bearer ${cred.token}`,
        },
      }
    );
    res.send(`
        <h1>Task List</h1>
        <button onClick="window.location.href='/tasklist/${
          req.params.id
        }/tasks/newtask';">Create New Task</button>
        <ul>
          ${response.data.items.map(
            (item) =>
              `
              <li><div><code>Title: ${item.title}</code></div>
              <button onClick="window.location.href='/tasklist/${req.params.id}/tasks/${item.id}?title=${item.title}';">Get Task</button></li>`
          )}
        </ul>
        Go back to <a href="/">Home screen</a></div><br>
        <p>Your account: <b>${req.cookies.role}</b></p>
      `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
}

async function task(req, res) {
  try {
    const cred = container.find(
      (item) => item.session === req.cookies.googleSession
    );
    // check user role - read task lists
    if (!cred) {
      res.status(400).send("Bad Request");
      return;
    }
    const response = await axios.get(
      "https://tasks.googleapis.com/tasks/v1/lists/" +
        req.params.id +
        "/tasks/" +
        req.params.task_id,
      {
        headers: {
          Authorization: `Bearer ${cred.token}`,
        },
      }
    );
    res.send(`
        <h1>Task ${req.query.title}</h1>
        <div><code>title: ${response.data.title}</code></div><br>
        <div><code>notes: ${response.data.notes}</code></div><br>
        <div><code>updated: ${response.data.updated}</code></div><br>
        <div><code>due: ${response.data.due}</code></div><br>
        Go back to <a href="/">Home screen</a></div><br>
        <p>Your account: <b>${req.cookies.role}</b></p>
      `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
}

async function newTask(req, res, next) {
  try {
    const cred = container.find(
      (item) => item.session === req.cookies.googleSession
    );
    // check user role - read task lists
    if (!cred) {
      res.status(400).send("Bad Request");
      return;
    }

    // check user role - write permission
    await checkPermission(req, res, next, cred);

    res.send(`
      <h1>Add Task</h1>
      <form method="GET" action="/tasklist/${req.params.id}/tasks/addednewtask">
        <p>title: <input type="text" name="title" value=""></p>
        <p>notes: <input type="text" name="notes" value=""></p>
        <input type="submit" value="Add">
      </form>
      Go back to <a href="/">Home screen</a></div><br>
      <p>Your account: <b>${req.cookies.role}</b></p>
    `);
  } catch (error) {
    if (error.code == "403") {
      res.status(403).send(`
          <p>${error.message}</p>
          Go back to <a href="/">Home screen</a></div><br>
        `);
    } else {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  }
}

async function addedNewTask(req, res) {
  try {
    const cred = container.find(
      (item) => item.session === req.cookies.googleSession
    );
    // check user role - read task lists
    if (!cred) {
      res.status(400).send("Bad Request");
      return;
    }

    const response = await axios.post(
      "https://tasks.googleapis.com/tasks/v1/lists/" + req.params.id + "/tasks",
      {
        title: req.query.title !== undefined ? req.query.title : "",
        notes: req.query.notes !== undefined ? req.query.notes : "",
        updated: req.query.updated !== undefined ? req.query.updated : "",
        due: req.query.due !== undefined ? req.query.due : "",
      },
      {
        headers: {
          Authorization: `Bearer ${cred.token}`,
        },
      }
    );
    res.redirect("/taskLists");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
}

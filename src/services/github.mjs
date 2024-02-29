import checkPermission from "../RBAC/rbac.mjs";
import crypto from "crypto";
import axios from "axios";
import FormData from "form-data";
import jwt from "jsonwebtoken";

const CALLBACK = "callback";

let credentials = {
  CLIENT_ID: "GITHUB_CLIENT_ID",
  CLIENT_SECRET: "GITHUB_CLIENT_SECRET",
};

let container = [];

export default function () {
  return {
    authenticate: authenticate,
    callback: callback,
    repos: repos,
    milestones: milestones,
    milestone: milestone,
  };
}

function authenticate(req, res) {
  let state = crypto.randomUUID();
  res.cookie("state", state, { httpOnly: true });
  // redirect to authorization endpoint
  res.redirect(
    302,
    // authorization endpoint
    "https://github.com/login/oauth/authorize?" +
      // client id
      "client_id=" +
      credentials.CLIENT_ID +
      "&" +
      // OpenID scope "openid repo"
      "scope=repo&" +
      // parameter state is used to check if the user-agent requesting login is the same making the request to the callback URL
      "state=" +
      state +
      "&" +
      // responde_type for "authorization code grant"
      "response_type=code&" +
      // redirect uri used to register RP
      "redirect_uri=http://localhost:3001/" +
      CALLBACK +
      "/github"
  );
}

async function callback(req, res) {
  try {
    if (req.query.state !== req.cookies.state) {
      res.status(400).send("Bad Request");
      return;
    }

    console.log("Making request to the github token endpoint");

    // Content-type: application/x-www-form-urlencoded (URL-Encoded Forms)
    const form = new FormData();
    form.append("code", req.query.code);
    form.append("client_id", credentials.CLIENT_ID);
    form.append("client_secret", credentials.CLIENT_SECRET);
    form.append(
      "redirect_uri",
      "http://localhost:3001/" + CALLBACK + "/github"
    );
    form.append("Accept", "application/json");
    // Make a POST request to the token endpoint
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      form,
      { headers: form.getHeaders() }
    );
    let user_token = (string) => {
      let token = string.split("&");
      return token[0].split("=")[1];
    };
    // Set cookies
    const session = crypto.randomUUID();
    const username = (
      await axios.get("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${user_token(response.data)}`,
        },
      })
    ).data.login;
    container.push({
      session: session,
      token: user_token(response.data),
      username: username,
    });

    res.cookie("githubSession", session, {
      expires: new Date(Date.now() + 900000),
      httpOnly: true,
    });
    res.send(`
        See <a href="/repos">Repositories Repos</a></div><br>
        Go back to <a href="/">Home screen</a></div><br>
        <p>Your account: <b>${req.cookies.role}</b></p>
      `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
}

async function repos(req, res) {
  try {
    const cred = container.find(
      (item) => item.session === req.cookies.githubSession
    );
    if (!cred) {
      res.status(400).send("Bad Request");
      return;
    }
    const response = await axios.get("https://api.github.com/user/repos", {
      headers: {
        Authorization: `Bearer ${cred.token}`,
      },
    });
    res.send(`
        <h1>Private Repos</h1>
        <ul>
          ${response.data.map(
            (item) => `
              <a href=/repos/private/${item.id}>${item.name};</a><br>
              <button onClick="window.location.href='/repos/${item.name}/milestones';">Get milestones</button><br>
          `
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

async function milestones(req, res) {
  try {
    const cred = container.find(
      (item) => item.session === req.cookies.githubSession
    );
    if (!cred) {
      res.status(400).send("Bad Request");
      return;
    }
    const response = await axios.get(
      `https://api.github.com/repos/${cred.username}/${req.params.id}/milestones`,
      {
        headers: {
          Authorization: `Bearer ${cred.token}`,
        },
      }
    );
    res.send(`
        <h1>Milestones From ${req.params.id} Repository</h1>
        <ul>
          ${response.data.map(
            (item) => `
              <a href=/repos/${req.params.id}/milestones/${item.number}>${item.title};</a><br>
          `
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

async function milestone(req, res) {
  try {
    const cred = container.find(
      (item) => item.session === req.cookies.githubSession
    );
    if (!cred) {
      res.status(400).send("Bad Request");
      return;
    }
    const response = await axios.get(
      `https://api.github.com/repos/${cred.username}/${req.params.id}/milestones/${req.params.milestone}`,
      {
        headers: {
          Authorization: `Bearer ${cred.token}`,
        },
      }
    );
    res.send(`
        <h1>Milestone</h1>
        <div><code>Title: ${response.data.title}</code></div><br>
        <div><code>Notes: ${response.data.description}</code></div><br>
        <div><code>Updated: ${response.data.updated_at}</code></div><br>
        <div><code>Due: ${response.data.due_on}</code></div><br>
        <form method="GET" action="/taskLists">
          <input type="hidden" name="title" value="${response.data.title}">
          <input type="hidden" name="description" value="${response.data.description}">
          <input type="hidden" name="updated" value="${response.data.updated_at}">
          <input type="hidden" name="due" value="${response.data.due_on}">
          <input type="hidden" name="new" value="">
          <input type="submit" value="Make It a Task">
        </form>
        Go back to <a href="/">Home screen</a></div><br>
        <p>Your account: <b>${req.cookies.role}</b></p>
      `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
}

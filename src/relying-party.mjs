import express from "express";
import cookieParser from "cookie-parser";
import googleServiceInit from "./services/google.mjs";
import githubServicesInit from "./services/github.mjs";

const googleService = googleServiceInit();
const githubServices = githubServicesInit();

const port = 3001;
// callback URL configured during Client registration in OIDC provider
const CALLBACK = "callback";
const app = express();

app.use(cookieParser());

// Home page
app.get("/", (req, resp) => {
  resp.send(
    "<br><a href=/authenticate/google>Authenticate with Google Account</a><br>"
  );
});

// Google Tasks API routes
app.get("/authenticate/google", googleService.authenticate);
app.get("/" + CALLBACK + "/google", googleService.callback);
app.get("/taskLists", googleService.taskLists);
app.get("/tasklist/:id/tasks", googleService.tasks);
app.get("/tasklist/:id/tasks/newtask", googleService.newTask);
app.get("/tasklist/:id/tasks/addednewtask", googleService.addedNewTask);
app.get("/tasklist/:id/tasks/:task_id", googleService.task);

// Github milestones API routes
app.get("/authenticate/github", githubServices.authenticate);
app.get("/" + CALLBACK + "/github", githubServices.callback);
app.get("/repos", githubServices.repos);
app.get("/repos/:id/milestones", githubServices.milestones);
app.get("/repos/:id/milestones/:milestone", githubServices.milestone);

app.listen(port, (err) => {
  if (err) {
    return console.log("something bad happened", err);
  }
  console.log(`server is listening on ${port}`);
});

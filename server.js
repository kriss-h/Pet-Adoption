const http = require("http");
const fs = require("fs");
const url = require("url");
const path = require("path");
const mongoose = require("mongoose");
const queryString = require("querystring");

mongoose
  .connect("mongodb://localhost:27017/petsy", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  age: Number,
  pno: Number,
  pin: Number,
  city: String,
  email: String,
  password: String,
  adoptedPets: { type: String, ref: 'pet_data' }
}, { collection: 'user_data' });
const User = mongoose.model("user_data", userSchema);

const petSchema = new mongoose.Schema({
  petId: Number,
  petName: String,
  petBreed: String,
  type: String,
  appearance: String,
  gender: String,
  location: String,
  age: String,
  vaccinated: String,
  desexed: String,
  wormed: String,
  image_data: String,
  adoptedBy: { type: String, ref: 'user_data' }
}, { collection: 'pet_data' });
const Pet = mongoose.model("pet_data", petSchema);

const rescueSchema = new mongoose.Schema({
  petType: String,
  conditionR: String,
  locationR: String,
  pinR: Number,
  phoneR: Number
}, { collection: 'rescue_data' });
const Rescue = mongoose.model("rescue_data", rescueSchema);

const navbar = () =>
  "<div><nav><ul><li><a href='/wtp'>Home</a></li><li><a href='/adopt'>Adopt Pet</a></li><li><a href='/rescue'>Rescue Pet</a></li><li><a href='/create'>Sign up</a></li></ul></nav></div>";

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { pathname } = url.parse(req.url, true);

  switch (pathname) {
    case "/":
      if (req.method === "GET") {
        serveFormPage(res, "wtp.html");
      } else if (req.method === "POST") {
        collectRequestData(req, (data) => {
          User.create(data)
            .then(() => {
              res.writeHead(302, { Location: "/" });
              res.end();
            })
            .catch((err) => {
              console.error("Error creating user:", err);
              res.writeHead(500);
              res.end("Error creating user");
            });
        });
      }
      break;

      case "/gallery":
      if (req.method === "GET") {
        serveFormPage(res, "gallery.html");
      }
      break;

    case "/create":
      if (req.method === "GET") {
        serveFormPage(res, "create.html");
      } else if (req.method === "POST") {
        collectRequestData(req, (data) => {
          User.create(data)
            .then(() => {
              res.writeHead(302, { Location: "/" });
              res.end();
            })
            .catch((err) => {
              console.error("Error creating user:", err);
              res.writeHead(500);
              res.end("Error creating user");
            });
        });
      }
      break;

    case "/pets":
      if (req.method === "GET") {
        const { query } = url.parse(req.url, true);
        const queryParams = new URLSearchParams(query);
        const location = queryParams.get("location");
        const petType = queryParams.get("petType");

        const queryOptions = {};
        if (location && location !== "all") {
          queryOptions.location = location;
        }
        if (petType && petType !== "all") {
          if (petType !== 'other') {
            queryOptions.type = petType;
          } else {
            queryOptions.type = { $in: ['Bird', 'Rabbit', 'Flemish Giant', 'Angora', 'Lionhead', 'Holland Lop'] };
          }
        }

        Pet.find(queryOptions)
          .then((pet_data) => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(pet_data));
          })
          .catch((err) => {
            console.error("Error fetching pets:", err);
            res.writeHead(500);
            res.end("Error fetching pets");
          });
      }
      break;

    case "/adopt":
      if (req.method === "GET") {
        serveFormPage(res, "adopt.html");
      } else if (req.method === "POST") {
        collectRequestData(req, (data) => {
          const { email, password, petId } = data;
          User.findOne({ email: email, password: password })
            .then((user) => {
              if (!user) {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end("<script>alert('Invalid email or password'); window.location='/adopt';</script>");
              } else {
                Pet.findByIdAndUpdate(petId, { adoptedBy: user.email }, { new: true })
                  .then((pet) => {
                    User.findByIdAndUpdate(user._id, { $push: { adoptedPets: pet.petId }}, { new: true })
                      .then(() => {
                        res.writeHead(302, { "Content-Type": "text/html" });
                        res.end("<script>alert('Pet adopted successfully'); window.location='/adopt';</script>");
                      })
                      .catch((err) => {
                        console.error("Error updating user with adopted pet:", err);
                        res.writeHead(500);
                        res.end("Error updating user with adopted pet");
                      });
                  })
                  .catch((err) => {
                    console.error("Error updating pet with adopter:", err);
                    res.writeHead(500);
                    res.end("Error updating pet with adopter");
                  });

              }
            })
            .catch((err) => {
              console.error("Error finding user:", err);
              res.writeHead(500);
              res.end("Error finding user");
            });
        });
      }
      break;

    case "/rescue":
      if (req.method === "POST") {
        collectRequestData(req, (data) => {
          Rescue.create(data)
            .then(() => {
              res.writeHead(302, { Location: "/" });
              res.end();
            })
            .catch((err) => {
              console.error("Error creating rescue request:", err);
              res.writeHead(500);
              res.end("Error creating rescue request");
            });
        });
      } else {
        serveFormPage(res, "rescue.html");
      }
      break;

    case "/view":
      if (req.method === "GET") {
        const { query } = url.parse(req.url, true);
        const petId = query.petId;

        if (!petId) {
          res.writeHead(400);
          res.end("Missing petId parameter");
          return;
        }

        Pet.findById(petId)
          .then((pet_data) => {
            if (!pet_data) {
              res.writeHead(404);
              res.end("Pet not found");
              return;
            }

            const viewFilePath = path.join(__dirname, "view.html");
            fs.readFile(viewFilePath, (err, viewData) => {
              if (err) {
                console.error(`Error reading ${viewFilePath}:`, err);
                res.writeHead(500);
                res.end("Server Error: Unable to read view page.");
                return;
              }
              res.writeHead(200, { "Content-Type": "text/html" });
              const modifiedViewContent = viewData.toString()
                .replace("{{PET_NAME}}", pet_data.petName)
                .replace("{{PET_BREED}}", pet_data.petBreed)
                .replace("{{PET_TYPE}}", pet_data.type)
                .replace("{{PET_APPEARANCE}}", pet_data.appearance)
                .replace("{{PET_GENDER}}", pet_data.gender)
                .replace("{{PET_LOCATION}}", pet_data.location)
                .replace("{{PET_AGE}}", pet_data.age)
                .replace("{{PET_VACCINATED}}", pet_data.vaccinated)
                .replace("{{PET_DESEXED}}", pet_data.desexed)
                .replace("{{PET_WORMED}}", pet_data.wormed)
                .replace("{{PET_ID}}", pet_data._id)
                .replace("${pet.image_data}", pet_data.image_data);
              res.end(modifiedViewContent);
            });
          })
          .catch((err) => {
            console.error("Error fetching pet details:", err);
            res.writeHead(500);
            res.end("Error fetching pet details");
          });
      }
      break;

    default:
      serveStaticFile(req, res);
      break;
  }
});

function serveStaticFile(req, res) {
  const filePath = path.join(__dirname, req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`Error reading ${filePath}:`, err);
      res.writeHead(404);
      res.end("File Not Found");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    const contentType = {
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".css": "text/css",
      ".js": "text/javascript"
    }[extension] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function serveFormPage(res, pageName) {
  const filePath = path.join(__dirname, pageName);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`Error reading ${filePath}:`, err);
      res.writeHead(500);
      res.end("Server Error: Unable to read form page.");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
}

function collectRequestData(request, callback) {
  let data = "";
  request.on("data", (chunk) => {
    data += chunk;
  });
  request.on("end", () => {
    if (request.headers['content-type'] === 'application/json') {
      data = JSON.parse(data);
    } else {
      data = queryString.parse(data);
    }
    callback(data);
  });
}

server.listen(9200, () => {
  console.log("Server running on http://localhost:9200");
});

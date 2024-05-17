const PORT = 4000;
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const midtransClient = require("midtrans-client");
const { v4: uuidv4 } = require("uuid");

app.use(express.json());
app.use(cors());

// connection database mongodb
mongoose.connect(
  "mongodb+srv://guswandi:01082003@cluster0.bwygkxi.mongodb.net/e-commerce"
);

// initial snap transaction
let snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: "SB-Mid-server-Tx4EkVBCmNBScVWk3RqfAoPO",
  clientKey: "SB-Mid-client-1Bmoz6gKq0WGRPKm",
});

// API creation

app.get("/", (req, res) => {
  res.send("Express App is running");
});

const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage: storage });

// Creating upload enpoint for images

app.use("/images", express.static("upload/images"));

app.post("/upload", upload.single("product"), (req, res) => {
  res.json({
    success: 1,
    image_url: `http://localhost:${PORT}/images/${req.file.filename}`,
  });
});

// schema creating product
const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  tag: {
    type: String,
    required: true,
  },
  information: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
});

// API creation product
app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  }
  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    old_price: req.body.old_price,
    new_price: req.body.new_price,
    description: req.body.description,
    tag: req.body.tag,
    information: req.body.information,
  });
  console.log(product);
  await product.save();
  console.log("Saved");
  res.json({
    success: true,
    name: req.body.name,
  });
});

// API remove product
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("Removed");
  res.json({
    success: true,
    name: req.body.name,
  });
});

// API get all product
app.get("/getallproducts", async (req, res) => {
  let products = await Product.find({});
  console.log("Get all product");
  res.send(products);
});

// schema creating user model
const Users = mongoose.model("Users", {
  username: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// creating endpoint for register
app.post("/signup", async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });

  if (check) {
    return res.status(400).json({
      success: false,
      errors: "Existing user found with same email address",
    });
  }

  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }

  const user = new Users({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  // save data to DB
  await user.save();

  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

// creating endpoint for login
app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id,
        },
      };
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.status(400).json({ success: false, errors: "Wrong password" });
    }
  } else {
    res.status(400).json({ success: false, errors: "Wrong email id" });
  }
});

// get product enpoint new collections
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let newCollections = products.slice(1).slice(-8);
  console.log("Get all product");
  res.send(newCollections);
});

// get product endpoint in popular in women
app.get("/popularinwomen", async (req, res) => {
  let product = await Product.find({ category: "women" });
  let popular_in_women = product.slice(0, 4);
  console.log("Get popular in women");
  res.send(popular_in_women);
});

// creating middleware to fetch user
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({ error: "Please authenticate using a valid token" });
  } else {
    try {
      const data = jwt.verify(token, "secret_ecom");
      req.user = data.user;
      next();
    } catch (error) {
      res
        .status(401)
        .send({ error: "Please authenticate using a valid token" });
    }
  }
};

// creating endpont for adding product in cartdata
app.post("/addtocart", fetchUser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("added to cart");
});

// creating endpoint for remove product in cartdata
app.post("/removefromcart", fetchUser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("removed from cart");
});

// creating endpoint for get cartData
app.post("/getcartdata", fetchUser, async (req, res) => {
  console.log("Get cart data");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

// get data product related/sesuai kategori
app.get("/productsbycategory", async (req, res) => {
  try {
    const category = req.query.category;

    const products = await Product.find({ category }).limit(4);
    if (!products || products.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, products });
  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// endpoint midtrans/pembayaran
app.post("/checkout", fetchUser, async (req, res) => {
  // fect data usernya
  let user = await Users.findOne({ _id: req.user.id });
  console.log(user);

  try {
    const { gross_amount } = req.body;

    if (isNaN(gross_amount)) {
      return res
        .status(400)
        .json({ success: false, message: "Gross amount must be a number" });
    }

    const orderId = uuidv4();

    let parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Number(gross_amount),
      },
      credit_card: {
        secure: true,
      },
      customer_details: {
        first_name: user.name,
        last_name: user.name,
        email: user.email,
        phone: "08111222333",
      },
    };
    snap.createTransaction(parameter).then((transaction) => {
      // Ambil token transaksi di sini
      let transactionToken = transaction.token;
      let url = transaction.redirect_url;
      console.log("transactionToken:", transactionToken);

      // Kirim token sebagai respons
      res.json({ success: true, token: transactionToken, url: url });
    });
  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.listen(PORT, (error) => {
  if (!error) {
    console.log("Server is runnning on port " + PORT);
  } else {
    console.log("Server error " + error);
  }
});

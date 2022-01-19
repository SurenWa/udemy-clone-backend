import express from "express";
import cors from "cors";
import fs from 'fs';
import csrf from "csurf";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

const morgan = require("morgan");
require("dotenv").config();

const csrfProtection = csrf({ cookie: true })

//create express app
const app = express();

//db
mongoose.connect(process.env.DATABASE, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('DB CONNECTED SUCCESSFULLY'))
.catch(err => console.log('DB CONNECTION ERROR', err))


//apply middlewares
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));
app.use(cookieParser());


//route
fs.readdirSync('./routes').map((r) => 
    app.use('/api', require(`./routes/${r}`))
)

//csrf
app.use(csrfProtection)

app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() })
})

//port
const port = process.env.PORT || 8000

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})

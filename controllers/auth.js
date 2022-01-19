import User from '../models/user';
import { hashPassword, comparePassword } from "../utils/auth";
import jwt from 'jsonwebtoken';
import AWS from 'aws-sdk';
import { nanoid } from 'nanoid';

const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    apiVersion: process.env.AWS_API_VERSION
}

const SES = new AWS.SES(awsConfig);

export const register = async (req, res) => {
    try {

        //console.log(req.body)
        const { name, email, password } = req.body;

        //validation
        if (!name) return res.status(400).send("Name is required");
        if (!password || password.length < 6) {
            return res
                .status(400)
                .send("Password is required and should be min 6 characters long")
        }

        let userExist = await User.findOne({ email }).exec();
        if (userExist) return res.status(400).send("Email is taken")

        //hash password
        const hashedPassword = await hashPassword(password);

        //register
        const user = new User({
            name,
            email,
            password: hashedPassword
        })

        await user.save()
        //console.log('saved user', user)
        return res.json({ ok: true })
        //return res.json(user)


    } catch (err) {
        //console.log(err);
        return res.status(400).send("Error. Try again.");

    }
}

export const login = async (req, res) => {
    try {
        //console.log(req.body)
        const { email, password } = req.body
        //check if our db has user with that email
        const user = await User.findOne({ email }).exec();
        if (!user) return res.status(400).send("No user found")
        //check password
        const match = await comparePassword(password, user.password)
        if (!match) return res.status(400).send("Wrong Password")
        //create signed jwt
        const token = jwt.sign(
            { _id: user._id },
            process.env.JWTSECRET,
            { expiresIn: "7d" }
        )
        //return user and token to client, exclude hashedpassword
        user.password = undefined
        //send token in cookie
        res.cookie("token", token, {
            httpOnly: true,
            //secure: true, //only works in https
        });
        //send the user as json response
        res.json(user)

    } catch (err) {
        console.log(err)
        return res.status(400).send("Error.Try again")
    }
}

export const logout = async (req, res) => {
    try {
        res.clearCookie("token")
        return res.json({ message: "Signout Success" })
    } catch (err) {
        console.log(err)
    }
}

export const currentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password").exec();
        console.log("CURRENT_USER", user);
        //return res.json(user);
        return res.json({ ok: true })
    } catch (err) {
        console.log(err);
    }
};

// export const sendTestEmail = async (req, res) => {
//     // console.log("Send Email Testing via Aws-ses")
//     // res.json({ ok: true })
//     const params = {
//         Source: process.env.EMAIL_FROM,
//         Destination: {
//             ToAddresses: ['cirrusminor2@gmail.com'],
//         },
//         ReplyToAddresses: [process.env.EMAIL_FROM],
//         Message: {
//             Body: {
//                 Html: {
//                     Charset: "UTF-8",
//                     Data: `
//                         <html>
//                             <h1>Reset Password Link</h1>
//                             <p>Please use the following link to reset your password</p>
//                         </html>
//                     `
//                 }
//             },

//             Subject: {
//                 Charset: "UTF-8",
//                 Data: "Password reset link"
//             }
//         }
//     }

//     const emailSent = SES.sendEmail(params).promise();

//     emailSent.then((data) => {
//         console.log(data);
//         res.json({ ok: true })
//     })
//     .catch((err) => {
//         console.log(err)
//     })
// }


/**
 * how password reset works ?
 * user will enter email address
 * you will find that user based on email from db
 * if found, you will create password reset code
 * then you will save that code in db and also send to that user's email
 * if this is the correct user, he will have access to that email
 * he can copy that code and paste in the form , enter new password then hit submit
 * on submit , our server will receive the user's email and code
 * you will try to find the user based on the email and code
 * if found, update his old password with new one and reset code back to empty
 * done
 */



export const forgotPassword = async (req, res) => {

    try {
        const { email } = req.body
        //console.log(email)
        const shortCode = nanoid(6).toUpperCase();
        const user = await User.findOneAndUpdate(
            { email },
            { passwordResetCode: shortCode }
        );
        if (!user) return res.status(400).send("User not found")

        //prepare for email
        const params = {
            Source: process.env.EMAIL_FROM,
            Destination: {
                ToAddresses: [email]
            },

            Message: {
                Body: {
                    Html: {
                        Charset: 'UTF-8',
                        Data: `
                            <html>
                                <h1>Reset Password</h1>
                                <p>Use this code to reset your password</p>
                                <h2 style="color: red">${shortCode}</h2>
                            </html>
                        `
                    }
                },
                Subject: {
                    Charset: "UTF-8",
                    Data: "Reset Password"
                }
            }
        }

        const emailSent = SES.sendEmail(params).promise();
        emailSent.then((data) => {
            console.log(data)
            res.json({ ok: true })
        })
            .catch((err) => {
                console.log(err)
            })
    } catch (err) {
        console.log(err)
    }
}


export const resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        // console.table({ email, code, newPassword });
        const hashedPassword = await hashPassword(newPassword);

        const user = User.findOneAndUpdate(
            {
                email,
                passwordResetCode: code,
            },
            {
                password: hashedPassword,
                passwordResetCode: "",
            }
        ).exec();
        res.json({ ok: true });
    } catch (err) {
        console.log(err);
        return res.status(400).send("Error! Try again.");
    }
};


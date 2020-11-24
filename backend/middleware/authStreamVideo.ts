import jwt from "jsonwebtoken";
import User, {UserInterface} from "../models/user";
import env from "../enviroment/env";
import {Request, Response, NextFunction} from "express";
import { ObjectID } from "mongodb";

interface RequestType extends Request {
    user?: UserInterface,
    token?: string,
    encryptedToken?: string,
}

// type jwtType = {
//     iv: Buffer,
//     user: userAccessType
// }

type jwtType = {
    iv: Buffer,
    _id: string,
    time: number
}

type userAccessType = {
    _id: string,
    emailVerified: boolean,
    email: string,
    admin: boolean,
    botChecked: boolean,
    username: string,
}

const removeOldTokens = async(userID: string, ipAddress: string | undefined, oldTime: number) => {

    try {

        const minusTime = oldTime - (60 * 1000 * 60 * 24);

        ipAddress = ipAddress ? ipAddress : "";

        if (ipAddress === "") return;

        await User.updateOne({_id: userID}, {$pull: {tempTokens: {ipAddress, time: {$lt: minusTime}}}})

    } catch (e) {
        console.log("cannot remove old tokens", e);
    }
}


const authStreamVideo = async(req: RequestType, res: Response, next: NextFunction) => {

    try {

        const accessTokenStreamVideo = req.cookies["video-access-token"];

        if (!accessTokenStreamVideo) throw new Error("No Stream Video Access Token");

        const decoded = jwt.verify(accessTokenStreamVideo, env.passwordAccess!) as jwtType;

        const time = decoded.time;

        const user = await User.findById(new ObjectID(decoded._id));

        if (!user) throw new Error("No User Stream Video");

        const encrpytionKey = user.getEncryptionKey();
        const encryptedToken = user.encryptToken(accessTokenStreamVideo, encrpytionKey, decoded.iv);

        let tokenFound = false;
        
        for (let i = 0; i < user.tempTokens.length; i++) {

            const currentEncryptedToken = user.tempTokens[i].token;

            if (currentEncryptedToken === encryptedToken) {

                tokenFound = true;
                removeOldTokens(user._id, req.clientIp, time);
                break;
            }
        }

        if (!tokenFound) throw new Error("Refresh Token Not Found");

        req.user = user;

        next();

    } catch (e) {
        console.log("\nAuthorization Middleware Error:", e.message);
        res.status(401).send("Error Authenticating");
    }
}

export default authStreamVideo;
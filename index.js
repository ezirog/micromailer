const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const auth = require('basic-auth');
const compare = require('tsscmp');

dotenv.config();

let fromEmail = process.env.FROM_EMAIL;
if (!fromEmail) {
    console.log('Missing FROM_EMAIL env var');
    process.exit(1);
}
let toEmail = process.env.TO_EMAIL;
let authLogin = process.env.AUTH_LOGIN;
let authPassword = process.env.AUTH_PASSWORD;

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: true, // secure:true for port 465, secure:false for port 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    },
    tls: {
      // do not fail on invalid certs
      rejectUnauthorized: false
    }
});

transporter.verify(function(error, success) {
  if (error) {
    console.log(error);
  } else {
    console.log("Server is ready to take our messages");
  }
});

const app = express();
app.set('port', process.env.PORT || 3000);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', (req, res) => {
    res.send('ready');
    // res.send(
    //     '<form method=post action=/send>' +
    //     '<input type=text name=fromName placeholder=fromName value=Test>' +
    //     '<input type=text name=subject placeholder=subject>' +
    //     '<input type=text name=body placeholder=body>' +
    //     '<input type=text name=replyTo placeholder=replyTo>' +
    //     '<input type=submit value=Send>' +
    //     '</form>'
    // );
});

app.post('/send', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    var credentials = auth(req);
    if (authLogin && authPassword && (!credentials || !checkAuthorization(credentials.name, credentials.pass))) {
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Basic realm="example"');
	  res.end(writeResponse('Access denied'));
	  return;
    }
	
    let fromName = req.body.fromName;
    if (!fromName || typeof fromName !== 'string') {
        res.status(400).send(writeResponse('Missing fromName'));
        return;
    }
    let subject = req.body.subject;
    if (!subject || typeof subject !== 'string') {
        res.status(400).send(writeResponse('Missing subject'));
        return;
    }
    let body = req.body.body;
    if (!body || typeof body !== 'string') {
        res.status(400).send(writeResponse('Missing body'));
        return;
    }
    let toEmailRequest = req.body.toEmail;
    if (!toEmailRequest || typeof toEmailRequest !== 'string') {
        if (!toEmail || typeof toEmail !== 'string') {            
            res.status(400).send(writeResponse('Missing toEmail'));
            return;
        }
    }
    else if (toEmail && (typeof toEmail !== 'string' || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(toEmail))) {
        res.status(400).send(writeResponse('Invalid toEmail'));
        return;
    } {
        toEmail = toEmailRequest;
    }
    
    let replyTo = req.body.replyTo;
    if (replyTo && (typeof replyTo !== 'string' || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(replyTo))) {
        res.status(400).send(writeResponse('Invalid replyTo'));
        return;
    }

    fromName = fromName.substring(0, 100);
    subject = subject.substring(0, 200);
    body = body.substring(0, parseInt(process.env.MAX_BODY_SIZE, 10) || 10000);

    const mailOptions = {
        from: '"' + fromName + '" <' + fromEmail + '>',
        to: toEmail,
        subject: subject,
        text: body,
    };
    if (replyTo) {
        mailOptions.replyTo = replyTo;
    }

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.log(err);
            res.status(500).send(writeResponse(err.message));
            return;
        }
        console.log('Message %s sent: %s', info.messageId, info.response);
        res.send(writeResponse('sent'));
    });
});

const server = app.listen(app.get('port'), () => {
  const port = server.address().port;
  console.log('Server running at http://localhost:' + port);
});

function writeResponse(body) {	
    return JSON.stringify({ message: body });
}

function checkAuthorization (name, pass) {
  var valid = true
 
  // Simple method to prevent short-circut and use timing-safe compare
  valid = compare(name, authLogin) && valid
  valid = compare(pass, authPassword) && valid
 
  return valid
}

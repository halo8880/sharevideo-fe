import React from 'react';
import {AppBar, Button, Grid, Modal, TextField, Toolbar, Typography} from '@mui/material';
import YouTube from 'react-youtube';
import axios from "axios";
import {Client} from '@stomp/stompjs'

const LOGIN_ENDPOINT = 'http://localhost:8081/api/v1/auth/signin';
const SHARE_VIDEO_ENDPOINT = 'http://localhost:8081/api/v1/video-sharing';
const WS_ENDPOINT = 'ws://localhost:8081/ws';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      token: localStorage.getItem('token'),
      username: '',
      password: '',
      isLoggedIn: false,
      videoModalOpen: false,
      videoUrl: '',
      videoDescription: '',
      sharedVideos: [],
      videoData: [],
    };
  }

  handleLogin = () => {
    axios.post(LOGIN_ENDPOINT, {username: this.state.username, password: this.state.password})
      .then(response => {
        const token = response.data.token;
        const username = response.data.username;
        // Assuming login is successful
        this.setState({isLoggedIn: true, username: username, token: token});
        // Store token in localStorage for later use
        localStorage.setItem('username', username);
        localStorage.setItem('token', token);
        this.connectWS();
      })
  };

  connectWS = () => {
    const stompClient = new Client({
      brokerURL: WS_ENDPOINT
    });
    stompClient.onConnect = (frame) => {
      // setConnected(true);
      console.log('Connected: ' + frame);
      const subTopic = '/topic/notify/' + this.state.token;
      // const subTopic = '/topic/notify/123';
      console.log("subscribing to", subTopic);
      stompClient.subscribe(subTopic, (data) => {
        console.log("Received message", JSON.parse(data.body));
        this.setState({sharedVideos: [JSON.parse(data.body), ...this.state.sharedVideos]}, () => this.loadAllSharedVideos())
      });
    };
    const sendName = () => {
      stompClient.publish({
        destination: "/app/hello",
        body: JSON.stringify(this.state.username)
      });
    }

    stompClient.onWebSocketError = (error) => {
      console.error('Error with websocket', error);
    };

    stompClient.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };
    stompClient.activate();
  }

  handleVideoShare = () => {
    const videoUrl = this.state.videoUrl;
    let videoId;
    if (videoUrl.includes("?v=")) {
      videoId = videoUrl.split("?v=")[1];
    } else {
      const split = videoUrl.split("/");
      videoId = split[split.length - 1];
    }
    axios.post(SHARE_VIDEO_ENDPOINT, {videoId: videoId}, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).then(() => {
      this.setState({
        videoModalOpen: false,
        videoId: ''
      }, () => this.loadAllSharedVideos());
    });
  };
  loadAllSharedVideos = () => {
    console.log("Loading all shared videos");
    axios.get(SHARE_VIDEO_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).then(response => {
      this.setState({sharedVideos: response.data}, () => {
        this.loadVideosData();
      });
    });
  }
  loadVideosData = () => {
    const videoId = this.state.sharedVideos.map(video => video.videoId).join(',');
    const apiKey = 'AIzaSyA0clAdTVQgWjUqAvtlRqytxQmE4NWiBYM';
    let videoData = [];
    let i = 0;
    fetch('https://www.googleapis.com/youtube/v3/videos?id=' + videoId + '&key=' + apiKey + '&part=snippet')
      .then(response => response.json())
      .then(data => {
        console.log(data);
        videoData = data.items.map(item => {
          return {
            desc: item.snippet.description,
            title: item.snippet.title,
            videoId: item.id,
            username: this.state.sharedVideos[i++].username
          }
        });
        this.setState({videoData});
      })
      .catch(error => console.error('Error fetching video details:', error));
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.isLoggedIn !== prevState.isLoggedIn && this.state.isLoggedIn) {
      this.loadAllSharedVideos();
    }
  }

  render() {
    const {username, password, isLoggedIn, videoModalOpen, videoUrl, videoData, sharedVideos} = this.state;

    return (
      <div>
        <AppBar position="sticky">
          <Grid container>
            <Grid item sm={6}></Grid>
            <Grid item sm={6}>
              <Toolbar>
                {isLoggedIn ? (
                  <Typography variant="h6">Hello {username}</Typography>
                ) : (
                  <>
                    <TextField
                      label="Username"
                      value={username}
                      variant="standard"
                      onChange={(e) => this.setState({username: e.target.value})}
                    />
                    <TextField
                      type="password"
                      label="Password"
                      value={password}
                      variant="standard"
                      onChange={(e) => this.setState({password: e.target.value})}
                    />
                    <Button color="inherit" onClick={this.handleLogin}>Login/Register</Button>
                  </>
                )}
                {isLoggedIn && (
                  <Button color="inherit" onClick={() => this.setState({videoModalOpen: true})}>Share Video</Button>
                )}
              </Toolbar>
            </Grid>
          </Grid>

        </AppBar>
        <Grid container spacing={1} style={{padding: '20px'}}>
          {videoData.map((sharedVideo, index) =>
            <>
              <Grid item sm={1}></Grid>
              <Grid item sm={4}>
                <iframe width="480" height="240" src={`https://www.youtube.com/embed/${sharedVideo.videoId}`}
                        frameBorder="0" allowFullScreen></iframe>
              </Grid>
              <Grid item sm={1}></Grid>
              <Grid item sm={5}>
                <Typography variant="h6">
                  {`${sharedVideo.username} shared: ${sharedVideo.title}`}
                </Typography>
                <Typography>
                  {sharedVideo.desc}
                </Typography>
              </Grid>
              <Grid item sm={1}></Grid>
            </>
          )}
        </Grid>
        <Modal open={videoModalOpen} onClose={() => this.setState({videoModalOpen: false, videoUrl: ""})}>
          <div style={{padding: '20px', backgroundColor: 'white', margin: 'auto'}}>
            <TextField
              label="Video URL"
              value={videoUrl}
              onChange={(e) => this.setState({videoUrl: e.target.value})}
            />
            <Button onClick={this.handleVideoShare}>Share Video</Button>
          </div>
        </Modal>
      </div>
    );
  }
}

export default App;
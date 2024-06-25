/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useState } from 'react';
import { Eye, Share2, Clock, Feather } from 'lucide-react';
import axios from 'axios';

interface Discover {
  id?: string;
  title: string;
  content: string;
  url: string;
}

const Page = () => {
  const [discover, setDiscover] = useState<Discover[] | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/discover`,
        );
        setDiscover(response.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <div className="container">
        <div className="row">
          <div className="flex items-center">
            <Feather />
            <h1 className="text-3xl font-medium p-2">Discover</h1>
          </div>
          <hr className="border-t-2 border-[#2B2C2C] my-4 w-full" />
        </div>

        {discover &&
          discover?.map((item, index) => (
            <>
              <div className="p-4 flex gap-4" key={index}>
                <div>
                  <img
                    src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${item.url}`}
                    alt=""
                    className="h-10 w-auto"
                  />
                </div>
                <div>
                  <div className="text-md font-semibold">{item.title}</div>
                  <div className="text-[#8D9191]">{item.content}</div>
                  <div className="flex flex-row gap-6 text-[#8D9191]">
                    <div className="flex gap-1 justify-center items-center">
                      <div>
                        <Eye size={16} />
                      </div>
                      <div>15744</div>
                    </div>
                    <div className="flex gap-1 justify-center items-center">
                      <div>
                        <Share2 size={16} />
                      </div>
                      <div>154</div>
                    </div>
                    <div className="flex gap-1 justify-center items-center">
                      <div>
                        <Clock size={16} />
                      </div>
                      <div>15</div>
                    </div>
                  </div>
                </div>
              </div>
              <hr className="border-t-1 border-[#2B2C2C] my-1 w-full" />
            </>
          ))}
      </div>
    </>
  );
};

export default Page;
